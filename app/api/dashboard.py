"""碳排全景驾驶舱路由（多租户隔离）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import Company, EmissionBudget, User
from ..services import dashboard_service as svc

router = APIRouter(prefix="/dashboard", tags=["全景驾驶舱"])


@router.get("/company/{company_id}/summary")
def summary(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_summary(db, company_id)


@router.get("/company/{company_id}/ring")
def ring(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_ring(db, company_id)


@router.get("/company/{company_id}/sankey")
def sankey(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_sankey(db, company_id)


@router.get("/company/{company_id}/trend")
def trend(company_id: int, forecast_months: int = 6, db: Session = Depends(get_db),
          user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_trend(db, company_id, forecast_months=forecast_months)


@router.get("/company/{company_id}/drilldown")
def drilldown(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_drilldown(db, company_id)


@router.get("/company/{company_id}/snapshot")
def snapshot(company_id: int, run_id: str | None = None, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return svc.get_snapshot(db, company_id, run_id)


class BudgetInput(BaseModel):
    annual_limit_kgco2e: float = Field(gt=0, le=1e15, allow_inf_nan=False)


@router.put("/company/{company_id}/budgets/{year}")
def set_budget(company_id: int, payload: BudgetInput, year: int = Path(ge=1900, le=2200),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    from ..services.inventory import lock_company
    from ..models.enterprise_domains import BudgetAllocation
    from sqlalchemy import func
    lock_company(db, company_id)
    distributed = db.query(func.sum(BudgetAllocation.amount_kgco2e)).filter_by(tenant_id=company_id,budget_year=year).scalar() or 0
    if payload.annual_limit_kgco2e < distributed:
        raise HTTPException(409, "年度总预算不能低于已分配的工厂月度额度")
    budget = db.get(EmissionBudget, (company_id, year))
    if budget is None:
        budget = EmissionBudget(company_id=company_id, year=year)
        db.add(budget)
    budget.annual_limit_kgco2e = payload.annual_limit_kgco2e
    db.commit()
    return svc.get_budget(db, company_id, year, svc.get_trend(db, company_id, 0)["historical"])
