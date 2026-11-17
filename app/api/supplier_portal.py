"""供应商门户：供应商自主填报碳数据、查看配额与减排计划。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import (
    CarbonQuota,
    ReductionPlan,
    Supplier,
    SupplierSubmission,
    User,
)

router = APIRouter(prefix="/supplier-portal", tags=["供应商门户"])


class SubmitRequest(BaseModel):
    period: str
    reported_emissions: float
    reported_intensity: float | None = None
    note: str | None = None


def _supplier_of(user: User, db: Session) -> Supplier:
    if user.role != "supplier" or not user.supplier_id:
        raise HTTPException(status_code=403, detail="仅供应商门户账号可访问")
    supplier = db.query(Supplier).filter(Supplier.supplier_id == user.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="供应商不存在")
    return supplier


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supplier = _supplier_of(user, db)
    quotas = db.query(CarbonQuota).filter(CarbonQuota.supplier_id == supplier.supplier_id).all()
    plans = db.query(ReductionPlan).filter(ReductionPlan.target_supplier_id == supplier.supplier_id).all()
    return {
        "supplier_id": supplier.supplier_id, "name": supplier.name, "industry": supplier.industry,
        "region": supplier.region, "tier": supplier.tier,
        "carbon_intensity": supplier.carbon_intensity, "annual_emissions": supplier.annual_emissions,
        "risk_level": supplier.risk_level,
        "quotas": [{"year": q.year, "allocated": q.allocated_quota, "used": q.used_quota,
                    "remaining": round(q.allocated_quota - q.used_quota, 4)} for q in quotas],
        "reduction_plans": [{"plan_id": p.plan_id, "title": p.title, "target_rate": p.target_reduction_rate,
                             "progress": p.progress, "status": p.status,
                             "deadline": p.deadline.isoformat() if p.deadline else None} for p in plans],
    }


@router.post("/report", status_code=201)
def submit_report(payload: SubmitRequest, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """供应商填报当期碳数据：更新档案、记录上报时间、自动扣减当期配额用量。"""
    supplier = _supplier_of(user, db)
    submission = SupplierSubmission(
        supplier_id=supplier.supplier_id,
        company_id=supplier.company_id or 0,
        period=payload.period,
        reported_emissions=payload.reported_emissions,
        reported_intensity=payload.reported_intensity,
        note=payload.note,
    )
    if supplier.company_id:
        submission.company_id = supplier.company_id
    supplier.annual_emissions = (supplier.annual_emissions or 0) + payload.reported_emissions
    if payload.reported_intensity is not None:
        supplier.carbon_intensity = payload.reported_intensity
    # 配额自动扣减
    year = int(payload.period[:4]) if len(payload.period) >= 4 else 2026
    quota = db.query(CarbonQuota).filter(
        CarbonQuota.supplier_id == supplier.supplier_id, CarbonQuota.year == year).first()
    if quota:
        quota.used_quota = round((quota.used_quota or 0) + payload.reported_emissions, 4)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return {
        "submission_id": submission.id, "supplier_id": supplier.supplier_id, "period": payload.period,
        "reported_emissions": payload.reported_emissions,
        "quota_remaining": round(quota.allocated_quota - quota.used_quota, 4) if quota else None,
    }


@router.get("/submissions")
def submissions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supplier = _supplier_of(user, db)
    rows = (
        db.query(SupplierSubmission)
        .filter(SupplierSubmission.supplier_id == supplier.supplier_id)
        .order_by(SupplierSubmission.id.desc())
        .all()
    )
    return [
        {"submission_id": s.id, "period": s.period, "reported_emissions": s.reported_emissions,
         "reported_intensity": s.reported_intensity, "note": s.note,
         "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in rows
    ]
