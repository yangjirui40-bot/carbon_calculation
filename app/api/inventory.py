"""企业月度盘查、独立复核与关账。"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..crypto import read_secret
from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import BusinessRecord, CalculationRun, User
from ..models.inventory import InventoryAssignment, InventoryEvent, InventoryPeriod
from ..services.inventory import current_ledger_digest, lock_company
from ..models.organization import ReportingBoundary, ReportingPeriod, ScopeAssessment
from ..services.organization import active_boundary, boundary_snapshot, is_company_admin, require_company_admin, scope_snapshot

router = APIRouter(prefix="/inventory", tags=["月度盘查"])
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1500)]


class CreatePeriod(BaseModel):
    period: Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")]
    boundary: Note
    boundary_id: int | None = None


class AssignmentUpdate(BaseModel):
    duty: Literal["coordinator", "reviewer"] | None = None


class CategoryAssessment(BaseModel):
    category: int
    status: Literal["included", "unavailable", "not_applicable", "excluded"]
    rationale: Note


class AssessmentInput(BaseModel):
    categories: list[CategoryAssessment]


class Decision(BaseModel):
    action: Literal["submit", "return", "close", "reopen"]
    expected_revision: int
    note: Note
    run_id: str | None = None


def assignment(db, company_id, user_id):
    entry = db.get(InventoryAssignment, (company_id, user_id))
    return entry.duty if entry else None


def status_counts(db, company_id, period=None):
    query = db.query(BusinessRecord.period, BusinessRecord.review_status, func.count()).filter_by(company_id=company_id)
    if period is not None:
        query = query.filter_by(period=period)
    counts = {}
    for month, state, count in query.group_by(BusinessRecord.period, BusinessRecord.review_status):
        if state == "rejected":
            continue
        totals = counts.setdefault(month, {"confirmed": 0, "unconfirmed": 0})
        totals["confirmed" if state == "confirmed" else "unconfirmed"] += count
    return counts


def period_data(row, counts):
    return {
        "period": row.period, "boundary": row.boundary, "status": row.status,
        "revision": row.revision, "run_id": row.run_id, "submitted_by": row.submitted_by,
        **counts.get(row.period, {"confirmed": 0, "unconfirmed": 0}),
    }


def require_period(db, company_id, period):
    row = db.query(InventoryPeriod).filter_by(company_id=company_id, period=period).first()
    if not row:
        raise HTTPException(status_code=404, detail="该月尚未建立盘查期间")
    return row


def log(db, row, actor, action, note):
    db.add(InventoryEvent(period_id=row.id, actor_id=actor.id, action=action, revision=row.revision,
                          run_id=row.run_id, note=note))


@router.get("/{company_id}")
def list_periods(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    rows = db.query(InventoryPeriod).filter_by(company_id=company_id).order_by(InventoryPeriod.period.desc()).all()
    counts = status_counts(db, company_id)
    bindings = {link.inventory_id: link.boundary_id for link in db.query(ReportingPeriod).filter_by(tenant_id=company_id)}
    return {"user_id": user.id, "duty": assignment(db, company_id, user.id),
            "can_manage": is_company_admin(db, user, company_id),
            "periods": [{**period_data(row, counts), "boundary_id": bindings.get(row.id)} for row in rows]}


@router.get("/{company_id}/people")
def list_people(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    people = db.query(User).filter_by(company_id=company_id, role="enterprise", is_active=True).order_by(User.username).all()
    duties = {a.user_id: a.duty for a in db.query(InventoryAssignment).filter_by(company_id=company_id)}
    return [{"id": user.id, "username": user.username, "duty": duties.get(user.id)} for user in people]


@router.put("/{company_id}/people/{user_id}")
def save_assignment(company_id: int, user_id: int, payload: AssignmentUpdate,
                    db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    require_company_admin(db, actor, company_id)
    lock_company(db, company_id)
    user = db.get(User, user_id)
    if not user or user.company_id != company_id or user.role != "enterprise" or not user.is_active:
        raise HTTPException(status_code=422, detail="请选择本企业的有效企业用户")
    entry = db.get(InventoryAssignment, (company_id, user_id))
    if payload.duty is None:
        if entry:
            db.delete(entry)
    elif entry:
        entry.duty = payload.duty
    else:
        db.add(InventoryAssignment(company_id=company_id, user_id=user_id, duty=payload.duty))
    db.commit()
    return {"id": user.id, "username": user.username, "duty": payload.duty}


@router.post("/{company_id}", status_code=201)
def create_period(company_id: int, payload: CreatePeriod,
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    lock_company(db, company_id)
    if db.query(InventoryPeriod).filter_by(company_id=company_id, period=payload.period).first():
        raise HTTPException(status_code=409, detail="该月已建立盘查期间")
    if user.role != "admin" and payload.boundary_id is None:
        raise HTTPException(422, "企业盘查须选已发布的结构化边界")
    structured = None
    if payload.boundary_id is not None:
        structured = db.query(ReportingBoundary).filter_by(tenant_id=company_id, id=payload.boundary_id).first()
        if structured is None:
            raise HTTPException(422, "请选择本企业已发布的边界版本")
    row = InventoryPeriod(company_id=company_id, period=payload.period, boundary=payload.boundary)
    db.add(row)
    db.flush()
    if structured:
        db.add(ReportingPeriod(inventory_id=row.id, tenant_id=company_id, boundary_id=structured.id))
    log(db, row, user, "open", payload.boundary)
    db.commit()
    return period_data(row, status_counts(db, company_id, row.period))


@router.get("/{company_id}/{period}/history")
def period_history(company_id: int, period: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    row = require_period(db, company_id, period)
    events = db.query(InventoryEvent, User.username).join(User, InventoryEvent.actor_id == User.id).filter(
        InventoryEvent.period_id == row.id
    ).order_by(InventoryEvent.id.desc())
    return [{"action": event.action, "revision": event.revision, "actor": name, "run_id": event.run_id,
             "note": event.note, "created_at": event.created_at} for event, name in events]


@router.get("/{company_id}/{period}/coverage")
def get_coverage(company_id: int, period: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    require_period(db, company_id, period)
    return scope_snapshot(db, company_id, period)


@router.put("/{company_id}/{period}/coverage")
def update_coverage(company_id: int, period: str, payload: AssessmentInput, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    lock_company(db, company_id)
    if assignment(db, company_id, user.id) != "coordinator":
        raise HTTPException(403, "需要盘查负责人岗位")
    row = require_period(db, company_id, period)
    if row.status != "open" or not db.get(ReportingPeriod, row.id):
        raise HTTPException(409, "仅可填写处于待归集状态的结构化盘查期间")
    if len(payload.categories) != 15 or {item.category for item in payload.categories} != set(range(1, 16)):
        raise HTTPException(422, "需要逐一说明范围 3 的十五个类别")
    for item in payload.categories:
        assessment = db.get(ScopeAssessment, (row.id, item.category))
        if assessment is None:
            assessment = ScopeAssessment(inventory_id=row.id, category=item.category)
            db.add(assessment)
        assessment.status, assessment.rationale, assessment.changed_by = item.status, item.rationale, user.id
    db.commit()
    return scope_snapshot(db, company_id, period)


def validate_managed_closing(db, row, run, request):
    boundary = active_boundary(db, row.company_id, row.period)
    if boundary is None:
        return
    if request.get("boundary_snapshot") != boundary_snapshot(db, boundary):
        raise HTTPException(409, "盘查边界与核算时不一致，请重新核算")
    assessment = scope_snapshot(db, row.company_id, row.period)
    if len(assessment) != 15 or assessment != request.get("scope_assessments"):
        raise HTTPException(409, "请完成范围 3 覆盖评估，再生成新的核算快照")
    if (run.result or {}).get("is_demo"):
        raise HTTPException(409, "正式关账不能使用演示因子")
    actual = {item.get("scope3_category") for item in (run.result or {}).get("items", []) if item.get("scope") == "scope3"}
    if actual != {item["category"] for item in assessment if item["status"] == "included"}:
        raise HTTPException(409, "范围 3 台账分类与覆盖评估不相符，确认数据与缺项后再送审")


def check_submission(db, row, run_id):
    from ..models.enterprise_controls import PeriodResponsibility, QualityIssue
    for model in (PeriodResponsibility, QualityIssue):
        unfinished = db.query(model.id).filter(model.period_id == row.id, model.state != "closed")
        if model is QualityIssue:
            unfinished = unfinished.filter(model.severity == "blocking")
        if unfinished.first():
            raise HTTPException(409, "请先完成并复核本月采集任务和阻断级质量问题")
    counts = status_counts(db, row.company_id, row.period).get(row.period, {})
    if not counts.get("confirmed") or counts.get("unconfirmed"):
        raise HTTPException(status_code=409, detail="至少需要一条已确认台账，且当月所有台账均须复核")
    run = db.query(CalculationRun).filter_by(run_id=run_id, company_id=row.company_id, operation="enterprise",
                                             status="success").first()
    if not run:
        raise HTTPException(status_code=409, detail="请选择本企业成功的月度核算结果")
    if len((run.result or {}).get("items", [])) != counts["confirmed"]:
        raise HTTPException(status_code=409, detail="核算结果没有完整覆盖已确认台账")
    request = read_secret(run.request_snapshot) or {}
    if (request.get("inventory_period") != row.period or
            request.get("ledger_digest") != current_ledger_digest(db, row.company_id, row.period)):
        raise HTTPException(status_code=409, detail="核算结果未覆盖当前台账版本。请按该月台账重新核算后提交")
    from ..services.energy import period_allocations
    if request.get("electricity_certificates", []) != period_allocations(db, row.company_id, row.period):
        raise HTTPException(409, "绿电分配已变更，请重新核算后送审")
    validate_managed_closing(db, row, run, request)
    # 已送审的旧快照可查阅，更正后再次送审使用新核算。
    if db.query(InventoryEvent.id).filter_by(period_id=row.id, action="submit", run_id=run_id).first():
        raise HTTPException(status_code=409, detail="该快照已用于上一轮送审，请重新核算")
    return run


@router.post("/{company_id}/{period}/decision")
def decide(company_id: int, period: str, payload: Decision,
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    lock_company(db, company_id)
    duty = assignment(db, company_id, user.id)
    row = require_period(db, company_id, period)
    if row.revision != payload.expected_revision:
        raise HTTPException(status_code=409, detail="期间版本已变更，请刷新页面")
    action = payload.action
    if action == "submit":
        if duty != "coordinator":
            raise HTTPException(status_code=403, detail="需要盘查负责人岗位")
        if row.status != "open":
            raise HTTPException(status_code=409, detail="该期间当前不可提交")
        reviewer = db.query(InventoryAssignment).join(User, User.id == InventoryAssignment.user_id).filter(
            InventoryAssignment.company_id == company_id, InventoryAssignment.duty == "reviewer",
            User.is_active.is_(True), User.role == "enterprise", User.company_id == company_id,
        ).first()
        if not reviewer:
            raise HTTPException(status_code=409, detail="请先为本企业配置独立复核人")
        run = check_submission(db, row, payload.run_id)
        row.run_id, row.submitted_by, row.status = run.run_id, user.id, "submitted"
        log(db, row, user, action, payload.note)
    else:
        if duty != "reviewer" or user.id == row.submitted_by:
            raise HTTPException(status_code=403, detail="需要与提交人不同的复核人")
        if row.status != ("closed" if action == "reopen" else "submitted"):
            raise HTTPException(status_code=409, detail="该期间当前不可执行此操作")
        log(db, row, user, action, payload.note)
        if action == "close":
            row.status = "closed"
        else:
            row.status, row.run_id, row.submitted_by = "open", None, None
            row.revision += 1
    db.commit()
    return period_data(row, status_counts(db, company_id, row.period))
