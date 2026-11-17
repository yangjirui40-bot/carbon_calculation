"""绿色金融审计路由：穿透核查、区块链哈希存证、审计日志（多租户隔离）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import CalculationRun, User
from ..services import audit_service as svc

router = APIRouter(prefix="/audit", tags=["绿色金融审计"])


def _check_run_access(db, user: User, run_id: str) -> None:
    run = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if run is None:
        return
    check_company_access(db, user, run.company_id)


@router.get("/run/{run_id}/trace")
def trace(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_run_access(db, user, run_id)
    return svc.get_trace(db, run_id)


@router.post("/run/{run_id}/attest")
def attest(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_run_access(db, user, run_id)
    return svc.attest(db, run_id)


@router.get("/run/{run_id}/attestation")
def attestation(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_run_access(db, user, run_id)
    return svc.get_attestation(db, run_id)


@router.get("/logs")
def logs(run_id: str | None = None, limit: int = 100, db: Session = Depends(get_db),
         user: User = Depends(get_current_user)):
    if run_id:
        _check_run_access(db, user, run_id)
    return svc.list_audit_logs(db, run_id=run_id, limit=limit)


@router.get("/export/audit-log")
def export_audit_log(run_id: str | None = None, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    if run_id:
        _check_run_access(db, user, run_id)
    return {"logs": svc.list_audit_logs(db, run_id=run_id, limit=1000)}
