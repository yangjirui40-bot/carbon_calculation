"""Register retired electricity instruments and match their quantities to actual consumption."""
import unicodedata
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import BusinessRecord, SourceDocument, User
from ..models.base import utcnow
from ..models.organization import Site, ActivityRevision, ActivityLocation
from ..models.enterprise_controls import EnergyCertificate as Certificate, CertificateAllocation as Allocation
from ..services.energy import allocated, allocation_fields, entries
from ..services.inventory import lock_company, require_open_period

router = APIRouter(prefix="/energy", tags=["绿电凭证"])
Month = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
Kwh = Annotated[Decimal, Field(gt=0, max_digits=20, decimal_places=4)]
FreeText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]


class CertificateInput(BaseModel):
    site_id: int
    proof_id: int
    issuer: Label
    serial: Label
    period_from: Month
    period_to: Month
    retirement_reference: FreeText
    credited_kwh: Kwh


class AllocateInput(BaseModel):
    record_no: Label
    applied_kwh: Kwh
    request_key: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9._-]{8,80}$")]


class Cancellation(BaseModel):
    reason: FreeText


def normalized(value):
    return unicodedata.normalize("NFKC", value).strip().casefold()


@router.get("/{cid}")
def register(cid: int, page: int = Query(1, ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, cid)
    credits = db.query(Certificate).filter_by(company_id=cid)
    active = db.query(Allocation.certificate_id, func.sum(Allocation.applied_kwh).label("used")).filter_by(
        company_id=cid, cancelled_at=None).group_by(Allocation.certificate_id).subquery()
    rows = db.query(Certificate, Site.name, active.c.used).join(Site, Site.id == Certificate.site_id).outerjoin(
        active, active.c.certificate_id == Certificate.id).filter(Certificate.company_id == cid)
    return {"total": credits.count(), "items": [
        {"id": c.id, "site": name, "site_id": c.site_id, "issuer": c.issuer, "serial": c.serial, "proof_id": c.proof_id,
         "period_from": c.period_from, "period_to": c.period_to, "retirement_reference": c.retirement_reference,
         "credited_kwh": c.credited_kwh, "remaining_kwh": c.credited_kwh-(used or 0)}
        for c,name,used in rows.order_by(Certificate.id.desc()).offset((page-1)*25).limit(25)]}


@router.post("/{cid}", status_code=201)
def add(cid: int, payload: CertificateInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, cid, write=True)
    lock_company(db, cid)
    if payload.period_from > payload.period_to:
        raise HTTPException(422, "开始月份不能晚于结束月份")
    if not db.query(Site.id).filter_by(tenant_id=cid, id=payload.site_id).first():
        raise HTTPException(422, "请选择本企业的工厂")
    proof = db.query(SourceDocument).filter_by(company_id=cid, id=payload.proof_id, doc_type="energy_certificate").first()
    if not proof or not proof.content_hash:
        raise HTTPException(422, "请上传含注销信息的绿电凭证原件")
    issuer, serial = normalized(payload.issuer), normalized(payload.serial)
    if max(len(issuer), len(serial)) > 160:
        raise HTTPException(422, "规范化后的编号或签发机构名称过长")
    cert = Certificate(company_id=cid, issuer_key=issuer, serial_key=serial, recorded_by=user.id, **payload.model_dump())
    db.add(cert)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "无法重复登记此签发机构和证书编号") from exc
    return {"id": cert.id}


@router.get("/{cid}/allocations")
def history(cid: int, page: int = Query(1, ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, cid)
    rows = entries(db,cid)
    return {"total": rows.count(), "items": [
        {**allocation_fields(a,c,r,h), "cancelled_at": a.cancelled_at, "cancellation_reason": a.cancellation_reason}
        for a,c,r,h in rows.order_by(Allocation.id.desc()).offset((page-1)*25).limit(25)]}


@router.get("/{cid}/{cert_id}/eligible")
def candidates(cid: int, cert_id: int, search: str = Query("", max_length=128), db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    check_company_access(db, user, cid)
    cert = db.query(Certificate).filter_by(company_id=cid,id=cert_id).first()
    if not cert:
        raise HTTPException(404, "凭证不存在")
    query = db.query(BusinessRecord).join(ActivityLocation, ActivityLocation.record_id == BusinessRecord.id).filter(
        BusinessRecord.company_id == cid, ActivityLocation.site_id == cert.site_id, BusinessRecord.review_status == "confirmed",
        BusinessRecord.category == "electricity", BusinessRecord.scope == "scope2", BusinessRecord.unit == "kWh",
        BusinessRecord.period.between(cert.period_from,cert.period_to), BusinessRecord.quantity > 0)
    if search:
        query = query.filter(BusinessRecord.record_no.contains(search, autoescape=True))
    return [{"record_no": r.record_no, "period": r.period, "quantity": r.quantity}
            for r in query.order_by(BusinessRecord.period.desc(),BusinessRecord.id.desc()).limit(50)]


@router.post("/{cid}/{cert_id}/allocations")
def assign(cid: int, cert_id: int, payload: AllocateInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, cid, write=True)
    lock_company(db,cid)
    prior = db.query(Allocation).filter_by(company_id=cid,request_key=payload.request_key).first()
    if prior:
        if prior.certificate_id != cert_id or db.get(BusinessRecord,prior.record_id).record_no != payload.record_no or prior.applied_kwh != payload.applied_kwh:
            raise HTTPException(409, "该操作编号已经用于其他分配")
        return {"id": prior.id}
    cert = db.query(Certificate).filter_by(company_id=cid,id=cert_id).first()
    row = db.query(BusinessRecord).filter_by(company_id=cid,record_no=payload.record_no,category="electricity",
                                             scope="scope2",unit="kWh",review_status="confirmed").first()
    if not cert or not row or not row.quantity or not row.location or row.location.site_id != cert.site_id:
        raise HTTPException(422, "请选择凭证所属工厂的已确认用电台账")
    require_open_period(db,cid,row.period,user.id)
    if not cert.period_from <= row.period <= cert.period_to:
        raise HTTPException(422, "用电月份超出凭证适用期间")
    available = min(cert.credited_kwh-allocated(db,cid,certificate_id=cert.id),
                    Decimal(str(row.quantity))-allocated(db,cid,record_id=row.id))
    if payload.applied_kwh > available:
        raise HTTPException(409, "分配量超过凭证余量或台账未覆盖电量")
    revision = db.query(ActivityRevision).filter_by(record_id=row.id).order_by(ActivityRevision.revision_no.desc()).first()
    if not revision:
        raise HTTPException(409, "请先在台账确认工厂归属并保存版本")
    item = Allocation(company_id=cid,certificate_id=cert.id,record_id=row.id,revision_id=revision.id,
                      request_key=payload.request_key,applied_kwh=payload.applied_kwh,allocated_by=user.id)
    db.add(item)
    db.commit()
    return {"id": item.id}


@router.post("/{cid}/allocations/{entry_id}/cancel")
def cancel(cid: int, entry_id: int, payload: Cancellation, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db,user,cid,write=True)
    lock_company(db,cid)
    item = db.query(Allocation).filter_by(company_id=cid,id=entry_id).first()
    if not item:
        raise HTTPException(404, "分配记录不存在")
    if not item.cancelled_at:
        require_open_period(db,cid,db.get(BusinessRecord,item.record_id).period,user.id)
        item.cancelled_at, item.cancelled_by, item.cancellation_reason = utcnow(), user.id, payload.reason
        db.commit()
    return {"id": item.id, "cancelled": True}


@router.get("/{cid}/warehouse/history")
def refresh_history(cid: int, before: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models.enterprise_controls import WarehouseRefresh
    check_company_access(db, user, cid)
    query = db.query(WarehouseRefresh).filter_by(company_id=cid)
    if before is not None:
        query = query.filter(WarehouseRefresh.id < before)
    return [{"id": r.id, "activities": r.activities, "periods": r.periods, "at": r.refreshed_at}
            for r in query.order_by(WarehouseRefresh.id.desc()).limit(100)]
