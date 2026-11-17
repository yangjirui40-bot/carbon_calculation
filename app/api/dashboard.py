"""碳排全景驾驶舱路由（多租户隔离）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import User
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
