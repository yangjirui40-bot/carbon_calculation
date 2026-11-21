"""合规报告路由：ISO 14064 / ISO 14067 生成与查询。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from typing import Literal
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import Report, User
from ..services.report_service import generate_iso14064, generate_pcf
from ..services.report_archive import MEDIA_TYPES, list_metadata, read_artifact

router = APIRouter(prefix="/reports", tags=["合规报告"])


class ISO14064Request(BaseModel):
    company_id: int
    run_id: str | None = None
    language: Literal["zh", "en", "de", "fr"] = "zh"
    require_closed_period: bool = False


class PCFRequest(BaseModel):
    product_id: str
    run_id: str | None = None
    language: Literal["zh", "en", "de", "fr"] = "zh"


@router.post("/iso14064")
def iso14064(payload: ISO14064Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    return generate_iso14064(db, payload.company_id, payload.run_id, payload.language,
                             require_closed_period=payload.require_closed_period)


@router.post("/pcf")
def pcf(payload: PCFRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models import Product
    p = db.query(Product).filter(Product.product_id == payload.product_id).first()
    if p:
        check_company_access(db, user, p.company_id, write=True)
    return generate_pcf(db, payload.product_id, payload.run_id, payload.language)


@router.get("/{report_no}")
def get_report(report_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(Report).filter(Report.report_no == report_no).first()
    if not r:
        raise HTTPException(status_code=404, detail="报告不存在")
    check_company_access(db, user, r.company_id)
    return {
        "report_no": r.report_no, "report_type": r.report_type, "title": r.title,
        "language": r.language, "status": r.status, "run_id": r.run_id, "content": r.content,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "artifacts": list_metadata(db, r),
    }


@router.get("/{report_no}/download")
def download_report(report_no: str, fmt: str = "pdf", db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """下载报告文件：fmt = pdf | xml（盘查清单 PDF 或平台交换 XML）。"""
    r = db.query(Report).filter(Report.report_no == report_no).first()
    if not r:
        raise HTTPException(status_code=404, detail="报告不存在")
    check_company_access(db, user, r.company_id)
    if fmt not in MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="fmt 仅支持 pdf / xml")
    body, digest, archived = read_artifact(db, r, fmt)
    return Response(
        content=body,
        media_type=MEDIA_TYPES[fmt],
        headers={
            "Content-Disposition": f'attachment; filename="{report_no}.{fmt}"',
            "X-Content-SHA256": digest,
            "X-Report-Archive": "archived" if archived else "legacy-rendered",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("")
def list_reports(company_id: int | None = None, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(Report).order_by(Report.id.desc())
    if cid:
        q = q.filter(Report.company_id == cid)
    return [{"report_no": r.report_no, "report_type": r.report_type, "title": r.title,
             "company_id": r.company_id, "status": r.status,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in q.limit(200).all()]
