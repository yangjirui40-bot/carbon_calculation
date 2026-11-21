"""供应链碳管理协同平台路由：供应商、拓扑、GNN 热力图、配额、减排计划（多租户隔离）。"""
from __future__ import annotations

from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import (
    CarbonQuota,
    Company,
    QuotaTrade,
    ReductionPlan,
    Supplier,
    SupplierSubmission,
    SupplyChainEdge,
    User,
)
from ..schemas import EdgeCreate, QuotaCreate, ReductionPlanCreate, SupplierCreate
from ..services.gnn import compute_heatmap

router = APIRouter(prefix="/supply-chain", tags=["供应链协同"])


from ..models.enterprise_controls import QuotaEntry, ReductionProgressEvent
from ..services.inventory import lock_company
from ..services.quota_ledger import tag_transfer


class ReductionProgress(BaseModel):
    note: str | None = Field(default=None, max_length=400)
    progress: float = Field(ge=0, le=1)


def _plan_dict(plan: ReductionPlan) -> dict:
    return {
        "plan_id": plan.plan_id, "title": plan.title, "target_supplier_id": plan.target_supplier_id,
        "target_reduction_rate": plan.target_reduction_rate, "progress": plan.progress,
        "status": plan.status, "deadline": plan.deadline.isoformat() if plan.deadline else None,
        "overdue": bool(plan.deadline and plan.deadline < date.today() and plan.progress < 1),
    }


@router.patch("/{company_id}/reduction-plans/{plan_id}")
def update_plan_progress(company_id: int, plan_id: str, payload: ReductionProgress,
                         db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    plan = db.query(ReductionPlan).filter_by(company_id=company_id, plan_id=plan_id).with_for_update().first()
    if plan is None:
        raise HTTPException(status_code=404, detail="未找到该企业的减排计划")
    if plan.progress != payload.progress:
        db.add(ReductionProgressEvent(company_id=company_id, actor_id=user.id, plan_id=plan.id, previous_progress=plan.progress, progress=payload.progress, note=payload.note))
    plan.progress = payload.progress
    plan.status = "completed" if payload.progress == 1 else "ongoing"
    db.commit()
    return _plan_dict(plan)



def _supplier_dict(s: Supplier) -> dict:
    return {
        "id": s.id, "supplier_id": s.supplier_id, "name": s.name, "industry": s.industry,
        "region": s.region, "tier": s.tier, "carbon_intensity": s.carbon_intensity,
        "annual_emissions": s.annual_emissions, "risk_level": s.risk_level, "company_id": s.company_id,
    }


@router.post("/suppliers", status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload.company_id = payload.company_id if payload.company_id is not None else user.company_id
    check_company_access(db, user, payload.company_id, write=True)
    if payload.company_id is None:
        raise HTTPException(status_code=422, detail="请指定供应商所属企业")
    if db.query(Supplier).filter(Supplier.supplier_id == payload.supplier_id).first():
        raise HTTPException(status_code=400, detail="供应商编号已存在")
    s = Supplier(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _supplier_dict(s)


@router.get("/suppliers")
def list_suppliers(company_id: int | None = None, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(Supplier).order_by(Supplier.id)
    if cid:
        q = q.filter(Supplier.company_id == cid)
    return [_supplier_dict(s) for s in q.all()]


@router.post("/edges", status_code=201)
def create_edge(payload: EdgeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 边涉及任意企业时校验该企业访问权限（供应链协同由链主企业发起）
    from ..models import Supplier as S
    for sid in (payload.source_id, payload.target_id):
        sup = db.query(S).filter(S.supplier_id == sid).first()
        company = db.query(Company).filter(Company.code == sid).first() if sup is None else None
        cid = sup.company_id if sup else company.id if company else None
        if cid is None:
            raise HTTPException(status_code=422, detail="供应链端点必须是已登记的企业或供应商")
        check_company_access(db, user, cid, write=True)
    e = SupplyChainEdge(**payload.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "source_id": e.source_id, "target_id": e.target_id,
            "relation_type": e.relation_type, "amount": e.amount}


def _graph_data(db, company_id: int) -> tuple[list[dict], list[dict]]:
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="企业不存在")
    suppliers = db.query(Supplier).filter(Supplier.company_id == company_id).all()
    node_ids = {s.supplier_id for s in suppliers} | {company.code}
    nodes = [{
        "id": company.code, "name": company.name, "tier": 0, "type": "company",
        "carbon_intensity": None, "annual_emissions": None,
    }]
    for s in suppliers:
        nodes.append({
            "id": s.supplier_id, "name": s.name, "tier": s.tier, "type": "supplier",
            "industry": s.industry, "region": s.region,
            "carbon_intensity": s.carbon_intensity, "annual_emissions": s.annual_emissions,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })
    edges = [
        {"source_id": e.source_id, "target_id": e.target_id, "relation_type": e.relation_type,
         "amount": e.amount, "transport_distance": e.transport_distance}
        for e in db.query(SupplyChainEdge).filter(
            SupplyChainEdge.source_id.in_(node_ids), SupplyChainEdge.target_id.in_(node_ids)).all()
    ]
    return nodes, edges


@router.get("/{company_id}/network")
def network(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    nodes, edges = _graph_data(db, company_id)
    return {"company_id": company_id, "nodes": nodes, "edges": edges}


@router.get("/{company_id}/heatmap")
def heatmap(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    nodes, edges = _graph_data(db, company_id)
    return compute_heatmap(nodes, edges, k=2)


@router.get("/{company_id}/suppliers/{supplier_id}/evidence")
def supplier_evidence(company_id: int, supplier_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    nodes, edges = _graph_data(db, company_id)
    heatmap = compute_heatmap(nodes, edges, k=2)
    node = next((n for n in heatmap["nodes"] if n["id"] == supplier_id and n["type"] == "supplier"), None)
    if node is None:
        raise HTTPException(status_code=404, detail="未找到该企业的供应商")
    related_ids = {e["source_id"] if e["target_id"] == supplier_id else e["target_id"]
                   for e in edges if supplier_id in (e["source_id"], e["target_id"])}
    submissions = db.query(SupplierSubmission).filter_by(
        company_id=company_id, supplier_id=supplier_id
    ).order_by(SupplierSubmission.period.desc()).limit(12).all()
    return {
        "node": node, "thresholds": heatmap["thresholds"],
        "relationships": [
            {"id": n["id"], "name": n["name"], "tier": n["tier"]}
            for n in nodes if n["id"] in related_ids
        ],
        "submissions": [{"period": s.period, "intensity": s.reported_intensity,
                         "emissions_kgco2e": s.reported_emissions} for s in submissions],
    }


@router.post("/quotas", status_code=201)
def create_quota(payload: QuotaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    if payload.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.supplier_id == payload.supplier_id, Supplier.company_id == payload.company_id).first()
        if supplier is None:
            raise HTTPException(status_code=422, detail="配额与供应商必须属于同一企业")
    lock_company(db, payload.company_id)
    if db.query(CarbonQuota.id).filter_by(company_id=payload.company_id, year=payload.year,
                                          supplier_id=payload.supplier_id).first():
        raise HTTPException(409, "该企业或供应商的年度配额已存在")
    q = CarbonQuota(**payload.model_dump())
    db.add(q)
    db.commit()
    db.refresh(q)
    return {"id": q.id, "company_id": q.company_id, "supplier_id": q.supplier_id, "year": q.year,
            "allocated_quota": q.allocated_quota, "used_quota": q.used_quota}


@router.get("/{company_id}/quotas")
def list_quotas(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    qs = db.query(CarbonQuota).filter(CarbonQuota.company_id == company_id).all()
    return [{"id": q.id, "supplier_id": q.supplier_id, "year": q.year,
             "allocated_quota": q.allocated_quota, "used_quota": q.used_quota,
             "remaining": round(q.allocated_quota - q.used_quota, 4)} for q in qs]


@router.post("/{company_id}/reduction-plans", status_code=201)
def create_reduction_plan(company_id: int, payload: ReductionPlanCreate, db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    if payload.target_supplier_id:
        supplier = db.query(Supplier).filter(Supplier.supplier_id == payload.target_supplier_id, Supplier.company_id == company_id).first()
        if supplier is None:
            raise HTTPException(status_code=422, detail="减排计划与目标供应商必须属于同一企业")
    data = payload.model_dump()
    data["company_id"] = company_id
    if data.get("deadline"):
        try:
            data["deadline"] = date.fromisoformat(data["deadline"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="截止日期须为 YYYY-MM-DD") from exc
    if db.query(ReductionPlan).filter_by(plan_id=payload.plan_id).first():
        raise HTTPException(status_code=409, detail="减排计划编号已存在")
    p = ReductionPlan(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _plan_dict(p)


@router.get("/{company_id}/reduction-plans")
def list_reduction_plans(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    plans = db.query(ReductionPlan).filter(ReductionPlan.company_id == company_id).all()
    return [_plan_dict(plan) for plan in plans]


@router.get("/{company_id}/report")
def supply_chain_report(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    nodes, edges = _graph_data(db, company_id)
    hm = compute_heatmap(nodes, edges, k=2)
    stats = hm.get("statistics", {})
    quotas = [
        {"id": q.id, "supplier_id": q.supplier_id, "year": q.year,
         "allocated_quota": q.allocated_quota, "used_quota": q.used_quota,
         "remaining": round(q.allocated_quota - q.used_quota, 4)}
        for q in db.query(CarbonQuota).filter(CarbonQuota.company_id == company_id).all()
    ]
    plans = [_plan_dict(plan) for plan in db.query(ReductionPlan).filter_by(company_id=company_id)]
    return {
        "company_id": company_id,
        "supplier_count": len(nodes) - 1,
        "hot_spots": [n for n in hm["nodes"] if n["risk_level"] in ("red", "yellow")],
        "risk_statistics": stats,
        "quotas": quotas,
        "reduction_plans": plans,
    }


@router.get("/{company_id}/report.xlsx")
def supply_disclosure(company_id: int, period: str = Query(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$"),
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """按期间汇总供应商申报及未报清单。各企业边界可能重叠，因此不加总供应商排放。"""
    import io
    from openpyxl import Workbook

    check_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="企业不存在")
    suppliers = db.query(Supplier).filter_by(company_id=company_id).order_by(Supplier.tier, Supplier.supplier_id).all()
    submissions = {}
    for row in db.query(SupplierSubmission).filter_by(company_id=company_id, period=period).order_by(SupplierSubmission.id):
        submissions[row.supplier_id] = row
    workbook = Workbook(write_only=True)
    summary = workbook.create_sheet("披露口径")
    summary.append(["供应链碳数据披露工作底稿"])
    # Explicit string cells prevent supplier-entered formula evaluation.
    from openpyxl.cell import WriteOnlyCell

    def append(sheet, values):
        cells = []
        for value in values:
            cell = WriteOnlyCell(sheet, value=value)
            if isinstance(value, str):
                cell.data_type = "s"
            cells.append(cell)
        sheet.append(cells)

    count = sum(supplier.supplier_id in submissions for supplier in suppliers)
    append(summary, ["企业", company.name])
    summary.append(["披露期间", period])
    summary.append(["在册供应商", len(suppliers)])
    summary.append(["有当期自主填报", count])
    summary.append(["无当期数据", len(suppliers) - count])
    summary.append(["口径", "供应商自主填报，未进行第三方核证。空缺不作零排放处理。"])
    summary.append(["边界", "供应商间边界可能重叠。本表不加总供应商排放，也不直接替代企业范围 3 核算。"])
    details = workbook.create_sheet("供应商明细")
    details.append(["供应商编号", "名称", "层级", "行业", "地区", "期间", "状态", "申报排放 kgCO₂e", "强度 kgCO₂e/CNY"])
    for supplier in suppliers:
        row = submissions.get(supplier.supplier_id)
        append(details, [supplier.supplier_id, supplier.name, supplier.tier, supplier.industry, supplier.region,
                         period, "自主填报" if row else "待填报",
                         row.reported_emissions if row else None, row.reported_intensity if row else None])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return Response(buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="supply-disclosure-{company_id}-{period}.xlsx"'})


# ---------------- 跨企业碳配额交易与对账 ----------------

class TradeCreate(BaseModel):
    seller_company_id: int
    buyer_company_id: int
    year: int = 2026
    amount: float = Field(gt=0, allow_inf_nan=False)
    price: float = Field(ge=0, allow_inf_nan=False)
    note: str | None = None


class TradeAction(BaseModel):
    note: str | None = None


def _trade_dict(t: QuotaTrade) -> dict:
    return {
        "trade_id": t.trade_id, "seller_company_id": t.seller_company_id,
        "buyer_company_id": t.buyer_company_id, "year": t.year,
        "amount": t.amount, "price": t.price, "status": t.status, "note": t.note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.post("/trades", status_code=201)
def propose_trade(payload: TradeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """发起配额交易（卖方发起或管理员代发）。"""
    check_company_access(db, user, payload.seller_company_id, write=True)
    if payload.seller_company_id == payload.buyer_company_id:
        raise HTTPException(status_code=422, detail="买卖双方不能相同")
    if db.get(Company, payload.buyer_company_id) is None:
        raise HTTPException(status_code=404, detail="买方企业不存在")
    t = QuotaTrade(
        trade_id=f"trade-{uuid.uuid4().hex[:10]}",
        seller_company_id=payload.seller_company_id,
        buyer_company_id=payload.buyer_company_id,
        year=payload.year,
        amount=payload.amount,
        price=payload.price,
        note=payload.note,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _trade_dict(t)


@router.post("/trades/{trade_id}/accept")
def accept_trade(trade_id: str, payload: TradeAction | None = None, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """接受交易：扣减卖方配额、增加买方配额（当年）。"""
    t = db.query(QuotaTrade).filter(QuotaTrade.trade_id == trade_id).with_for_update().first()
    if not t:
        raise HTTPException(status_code=404, detail="交易不存在")
    check_company_access(db, user, t.buyer_company_id, write=True)
    if t.status != "pending":
        raise HTTPException(status_code=400, detail=f"交易状态为 {t.status}，不可接受")
    tag_transfer(db, t.trade_id)
    for cid in sorted((t.seller_company_id, t.buyer_company_id)):
        lock_company(db, cid)
    for cid in sorted([t.seller_company_id, t.buyer_company_id]):
        delta = -t.amount if cid == t.seller_company_id else t.amount
        quota = db.query(CarbonQuota).filter(
            CarbonQuota.company_id == cid, CarbonQuota.year == t.year, CarbonQuota.supplier_id.is_(None)).with_for_update().first()
        if quota is None:
            quota = CarbonQuota(company_id=cid, year=t.year, allocated_quota=0, used_quota=0)
            db.add(quota)
        if cid == t.seller_company_id and (quota.allocated_quota or 0) - (quota.used_quota or 0) < t.amount:
            db.rollback()
            raise HTTPException(status_code=409, detail="卖方可用配额不足；交易未成交")
        quota.allocated_quota = round((quota.allocated_quota or 0) + delta, 4)
    t.status = "accepted"
    if payload and payload.note:
        t.note = (t.note or "") + f"；{payload.note}"
    db.commit()
    db.refresh(t)
    return _trade_dict(t)


@router.post("/trades/{trade_id}/decline")
def decline_trade(trade_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(QuotaTrade).filter(QuotaTrade.trade_id == trade_id).with_for_update().first()
    if not t:
        raise HTTPException(status_code=404, detail="交易不存在")
    check_company_access(db, user, t.buyer_company_id, write=True)
    if t.status != "pending":
        raise HTTPException(status_code=400, detail="交易已处理")
    t.status = "declined"
    db.commit()
    return _trade_dict(t)


@router.get("/{company_id}/trades")
def list_trades(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    rows = (
        db.query(QuotaTrade)
        .filter((QuotaTrade.seller_company_id == company_id) | (QuotaTrade.buyer_company_id == company_id))
        .order_by(QuotaTrade.id.desc())
        .all()
    )
    return [_trade_dict(t) for t in rows]


@router.get("/{company_id}/trades/report")
def trade_reconciliation(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """配额交易对账报表：已成交明细 + 净变动汇总。"""
    check_company_access(db, user, company_id)
    accepted = (
        db.query(QuotaTrade)
        .filter((QuotaTrade.seller_company_id == company_id) | (QuotaTrade.buyer_company_id == company_id),
                QuotaTrade.status == "accepted")
        .all()
    )
    sold = sum(t.amount for t in accepted if t.seller_company_id == company_id)
    bought = sum(t.amount for t in accepted if t.buyer_company_id == company_id)
    revenue = sum(t.amount * t.price for t in accepted if t.seller_company_id == company_id)
    expense = sum(t.amount * t.price for t in accepted if t.buyer_company_id == company_id)
    return {
        "company_id": company_id,
        "summary": {
            "sold_total": round(sold, 4), "bought_total": round(bought, 4),
            "net_quota_change": round(bought - sold, 4),
            "revenue": round(revenue, 2), "expense": round(expense, 2),
            "net_cash": round(revenue - expense, 2),
        },
        "trades": [_trade_dict(t) for t in accepted],
    }

@router.get("/{company_id}/journal")
def quota_history(company_id: int, before: int | None = None, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    query = db.query(QuotaEntry, CarbonQuota).join(CarbonQuota, CarbonQuota.id == QuotaEntry.quota_id).filter(
        QuotaEntry.company_id == company_id)
    if before is not None:
        query = query.filter(QuotaEntry.id < before)
    return [{"id": e.id, "year": q.year, "supplier": q.supplier_id, "kind": e.kind, "reference": e.reference,
             "allocated_delta": e.allocated_delta, "used_delta": e.used_delta,
             "available_after": e.allocated_after-e.used_after, "at": e.posted_at}
            for e, q in query.order_by(QuotaEntry.id.desc()).limit(100)]


@router.get("/{company_id}/progress-history")
def progress_history(company_id: int, before: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    rows = db.query(ReductionProgressEvent, ReductionPlan).join(
        ReductionPlan, ReductionPlan.id == ReductionProgressEvent.plan_id
    ).filter(ReductionProgressEvent.company_id == company_id)
    if before is not None:
        rows = rows.filter(ReductionProgressEvent.id < before)
    rows = rows.order_by(ReductionProgressEvent.id.desc()).limit(100)
    return [{"id": e.id, "plan": p.title, "from": e.previous_progress, "to": e.progress, "note": e.note,
             "actor": e.actor_id, "at": e.created_at} for e, p in rows]
