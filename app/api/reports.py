"""合规报告路由：ISO 14064 / ISO 14067 生成与查询。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import Report, User
from ..services.report_service import generate_iso14064, generate_pcf
from ..services.report_files import iso14064_pdf, iso14064_xml, pcf_pdf, pcf_xml

router = APIRouter(prefix="/reports", tags=["合规报告"])


class ISO14064Request(BaseModel):
    company_id: int
    run_id: str | None = None
    language: str = "zh"


class PCFRequest(BaseModel):
    product_id: str
    run_id: str | None = None
    language: str = "zh"


@router.post("/iso14064")
def iso14064(payload: ISO14064Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id)
    return generate_iso14064(db, payload.company_id, payload.run_id, payload.language)


@router.post("/pcf")
def pcf(payload: PCFRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models import Product
    p = db.query(Product).filter(Product.product_id == payload.product_id).first()
    if p:
        check_company_access(db, user, p.company_id)
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
    }


@router.get("/{report_no}/download")
def download_report(report_no: str, fmt: str = "pdf", db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """下载报告文件：fmt = pdf | xml（ISO 14064 盘查清单 / ISO 14067·CBAM 兼容 XML 数据包）。"""
    r = db.query(Report).filter(Report.report_no == report_no).first()
    if not r:
        raise HTTPException(status_code=404, detail="报告不存在")
    check_company_access(db, user, r.company_id)
    content = r.content or {}
    if fmt not in ("pdf", "xml"):
        raise HTTPException(status_code=400, detail="fmt 仅支持 pdf / xml")
    if r.report_type == "PCF":
        body = pcf_pdf(content, r.language) if fmt == "pdf" else pcf_xml(content)
        media = "application/pdf" if fmt == "pdf" else "application/xml"
        ext = fmt
    else:
        body = iso14064_pdf(content, r.language) if fmt == "pdf" else iso14064_xml(content)
        media = "application/pdf" if fmt == "pdf" else "application/xml"
        ext = fmt
    filename = f"{report_no}.{ext}"
    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
