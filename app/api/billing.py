"""订阅计费路由：套餐、订阅、用量。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Plan, Subscription, User
from ..services.billing_service import subscribe

router = APIRouter(prefix="/billing", tags=["订阅计费"])


class SubscribeRequest(BaseModel):
    company_id: int
    plan_code: str


@router.get("/plans")
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [
        {"plan_code": p.plan_code, "name": p.name, "price_yearly": p.price_yearly,
         "quota_calculations": p.quota_calculations, "quota_documents": p.quota_documents,
         "features": p.features}
        for p in db.query(Plan).order_by(Plan.id).all()
    ]


@router.post("/subscribe")
def create_subscription(payload: SubscribeRequest, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    from ..deps import check_company_access
    check_company_access(db, user, payload.company_id, write=True)
    if payload.plan_code != "free" and user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可开通付费套餐（对接支付后开放自助订阅）")
    if user.role != "admin":
        from ..services.inventory import lock_company
        lock_company(db, payload.company_id)
        current = db.query(Subscription).filter_by(company_id=payload.company_id).first()
        if current and current.plan_code != "free":
            raise HTTPException(409, "企业套餐变更请联系平台管理员")
    sub = subscribe(db, payload.company_id, payload.plan_code)
    return {"company_id": sub.company_id, "plan_code": sub.plan_code, "status": sub.status,
            "start_date": sub.start_date.isoformat(), "end_date": sub.end_date.isoformat()}


@router.get("/company/{company_id}/subscription")
def get_subscription(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..deps import check_company_access
    check_company_access(db, user, company_id)
    sub = db.query(Subscription).filter(Subscription.company_id == company_id).first()
    if not sub:
        return {"company_id": company_id, "plan_code": "free", "status": "trial",
                "usage_calculations": 0, "usage_documents": 0}
    plan = db.query(Plan).filter(Plan.plan_code == sub.plan_code).first()
    return {
        "company_id": sub.company_id, "plan_code": sub.plan_code, "status": sub.status,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "end_date": sub.end_date.isoformat() if sub.end_date else None,
        "usage_calculations": sub.usage_calculations,
        "usage_documents": sub.usage_documents,
        "quota_calculations": plan.quota_calculations if plan else None,
        "quota_documents": plan.quota_documents if plan else None,
        "remaining_calculations": max(0, (plan.quota_calculations - sub.usage_calculations)) if plan else None,
    }


@router.get("/company/{company_id}/usage-events")
def usage_events(company_id: int, before: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..deps import check_company_access
    from ..models.enterprise_controls import UsageEvent
    check_company_access(db, user, company_id)
    query = db.query(UsageEvent).filter_by(company_id=company_id)
    if before is not None:
        query = query.filter(UsageEvent.id < before)
    return [{"id": row.id, "kind": row.usage_type, "quantity": row.quantity, "at": row.occurred_at}
            for row in query.order_by(UsageEvent.id.desc()).limit(100)]
