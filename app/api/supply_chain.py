"""供应链碳管理协同平台路由：供应商、拓扑、GNN 热力图、配额、减排计划（多租户隔离）。"""
from __future__ import annotations

from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException
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
    SupplyChainEdge,
    User,
)
from ..schemas import EdgeCreate, QuotaCreate, ReductionPlanCreate, SupplierCreate
from ..services.gnn import compute_heatmap

router = APIRouter(prefix="/supply-chain", tags=["供应链协同"])


def _supplier_dict(s: Supplier) -> dict:
    return {
        "id": s.id, "supplier_id": s.supplier_id, "name": s.name, "industry": s.industry,
        "region": s.region, "tier": s.tier, "carbon_intensity": s.carbon_intensity,
        "annual_emissions": s.annual_emissions, "risk_level": s.risk_level, "company_id": s.company_id,
    }


@router.post("/suppliers", status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.company_id:
        check_company_access(db, user, payload.company_id, write=True)
    else:
        payload.company_id = user.company_id
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
        if sup and sup.company_id:
            check_company_access(db, user, sup.company_id, write=True)
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
    supplier_ids = {s.supplier_id for s in suppliers}
    nodes = [{
        "id": company.code, "name": company.name, "tier": 0, "type": "company",
        "carbon_intensity": None, "annual_emissions": None,
    }]
    for s in suppliers:
        nodes.append({
            "id": s.supplier_id, "name": s.name, "tier": s.tier, "type": "supplier",
            "industry": s.industry, "region": s.region,
            "carbon_intensity": s.carbon_intensity, "annual_emissions": s.annual_emissions,
        })
    edges = [
        {"source_id": e.source_id, "target_id": e.target_id, "relation_type": e.relation_type,
         "amount": e.amount, "transport_distance": e.transport_distance}
        for e in db.query(SupplyChainEdge).all()
        if e.source_id in supplier_ids or e.target_id in supplier_ids or e.source_id == company.code or e.target_id == company.code
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


@router.post("/quotas", status_code=201)
def create_quota(payload: QuotaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
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
    data = payload.model_dump()
    data["company_id"] = company_id
    if data.get("deadline"):
        data["deadline"] = date.fromisoformat(data["deadline"])
    p = ReductionPlan(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"plan_id": p.plan_id, "title": p.title, "status": p.status, "progress": p.progress}


@router.get("/{company_id}/reduction-plans")
def list_reduction_plans(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    plans = db.query(ReductionPlan).filter(ReductionPlan.company_id == company_id).all()
    return [{"plan_id": p.plan_id, "title": p.title, "target_supplier_id": p.target_supplier_id,
             "target_reduction_rate": p.target_reduction_rate, "progress": p.progress,
             "status": p.status, "deadline": p.deadline.isoformat() if p.deadline else None} for p in plans]


@router.get("/{company_id}/report")
def supply_chain_report(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    nodes, edges = _graph_data(db, company_id)
    hm = compute_heatmap(nodes, edges, k=2)
    stats = hm.get("statistics", {})
    return {
        "company_id": company_id,
        "supplier_count": len(nodes) - 1,
        "hot_spots": [n for n in hm["nodes"] if n["risk_level"] in ("red", "yellow")],
        "risk_statistics": stats,
        "quotas": list_quotas(company_id, db),
        "reduction_plans": list_reduction_plans(company_id, db),
    }


# ---------------- 跨企业碳配额交易与对账 ----------------

class TradeCreate(BaseModel):
    seller_company_id: int
    buyer_company_id: int
    year: int = 2026
    amount: float = Field(gt=0)
    price: float = Field(ge=0)
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
    t = db.query(QuotaTrade).filter(QuotaTrade.trade_id == trade_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="交易不存在")
    check_company_access(db, user, t.buyer_company_id, write=True)
    if t.status != "pending":
        raise HTTPException(status_code=400, detail=f"交易状态为 {t.status}，不可接受")
    for cid, delta in ((t.seller_company_id, -t.amount), (t.buyer_company_id, t.amount)):
        quota = db.query(CarbonQuota).filter(
            CarbonQuota.company_id == cid, CarbonQuota.year == t.year, CarbonQuota.supplier_id.is_(None)).first()
        if quota is None:
            quota = CarbonQuota(company_id=cid, year=t.year, allocated_quota=0, used_quota=0)
            db.add(quota)
        quota.allocated_quota = round((quota.allocated_quota or 0) + delta, 4)
    t.status = "accepted"
    if payload and payload.note:
        t.note = (t.note or "") + f"；{payload.note}"
    db.commit()
    db.refresh(t)
    return _trade_dict(t)


@router.post("/trades/{trade_id}/decline")
def decline_trade(trade_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(QuotaTrade).filter(QuotaTrade.trade_id == trade_id).first()
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
