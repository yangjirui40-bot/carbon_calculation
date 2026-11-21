"""Send specific supplier requests, review responses, and publish accepted data."""
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import CarbonQuota, Supplier, SupplierSubmission, User
from ..models.disclosure import DisclosureCampaign, DisclosureRequest, SupplierEmissionData
from ..services.inventory import lock_company
from ..services.organization import is_company_admin, require_company_admin
from .supplier_portal import _supplier_of

router = APIRouter(prefix="/disclosures", tags=["供应商定向披露"])
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1500)]


class CampaignCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    period: Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")]
    instructions: Note
    due_on: date
    supplier_ids: list[int] = Field(min_length=1, max_length=300)


class ReportInput(BaseModel):
    emissions_kgco2e: Decimal = Field(ge=0, max_digits=25, decimal_places=6)
    intensity: Decimal | None = Field(default=None, ge=0, max_digits=24, decimal_places=10)
    boundary: Note
    note: Note


class ReviewInput(BaseModel):
    version_no: int
    decision: Literal["return", "approve"]
    note: Note


def data_row(row):
    return {"id": row.id, "version_no": row.version_no, "emissions_kgco2e": str(row.emissions_kgco2e),
            "intensity": str(row.intensity) if row.intensity is not None else None,
            "boundary": row.boundary, "note": row.note, "state": row.state, "review_note": row.review_note,
            "published_id": row.published_id, "created_at": row.created_at.isoformat()}


def request_row(row, campaign, supplier, versions):
    return {"id": row.id, "supplier_id": supplier.id, "supplier_name": supplier.name,
            "title": campaign.name, "period": row.period, "instructions": campaign.instructions,
            "due_on": campaign.due_on.isoformat(), "status": row.status,
            "versions": [data_row(version) for version in versions]}


def _requests(db, company_id, supplier_id=None):
    q = db.query(DisclosureRequest, DisclosureCampaign, Supplier).join(
        DisclosureCampaign, DisclosureCampaign.id == DisclosureRequest.campaign_id
    ).join(Supplier, Supplier.id == DisclosureRequest.supplier_id).filter(DisclosureRequest.tenant_id == company_id)
    if supplier_id is not None:
        q = q.filter(DisclosureRequest.supplier_id == supplier_id)
    rows = q.order_by(DisclosureCampaign.due_on, DisclosureRequest.id.desc()).limit(1000).all()
    by_request = {}
    for version in db.query(SupplierEmissionData).filter(SupplierEmissionData.request_id.in_(
         [request.id for request, _, _ in rows])).order_by(SupplierEmissionData.version_no.desc()):
        by_request.setdefault(version.request_id, []).append(version)
    return [request_row(row, campaign, supplier, by_request.get(row.id, [])) for row, campaign, supplier in rows]


@router.get("/portal")
def supplier_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supplier = _supplier_of(user, db)
    return _requests(db, supplier.company_id, supplier.id)


@router.post("/portal/{request_id}", status_code=201)
def submit_task(request_id: int, payload: ReportInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supplier = _supplier_of(user, db)
    row = db.query(DisclosureRequest).filter_by(id=request_id, supplier_id=supplier.id, tenant_id=supplier.company_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "没有可访问的报送任务")
    if row.status not in {"requested", "returned"}:
        raise HTTPException(409, "该请求已提交或已通过复核")
    latest = db.query(SupplierEmissionData).filter_by(request_id=row.id).order_by(SupplierEmissionData.version_no.desc()).first()
    update = SupplierEmissionData(request_id=row.id, version_no=latest.version_no+1 if latest else 1,
                                  submitted_by=user.id, **payload.model_dump())
    db.add(update)
    row.status = "submitted"
    db.commit()
    return data_row(update)


@router.get("/{company_id}")
def company_tasks(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    return {"can_manage": is_company_admin(db, user, company_id), "requests": _requests(db, company_id)}


@router.post("/{company_id}", status_code=201)
def create_campaign(company_id: int, payload: CampaignCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    lock_company(db, company_id)
    ids = set(payload.supplier_ids)
    chosen = db.query(Supplier).filter(Supplier.company_id == company_id, Supplier.id.in_(ids)).all()
    if len(chosen) != len(ids) or len(ids) != len(payload.supplier_ids):
        raise HTTPException(422, "请选择互不重复的本企业供应商")
    repeated = db.query(DisclosureRequest.id).filter(DisclosureRequest.tenant_id == company_id,
        DisclosureRequest.period == payload.period, DisclosureRequest.supplier_id.in_(ids)).first()
    if repeated:
        raise HTTPException(409, "部分供应商已有该期定向任务")
    campaign = DisclosureCampaign(tenant_id=company_id, created_by=user.id, **payload.model_dump(exclude={"supplier_ids"}))
    db.add(campaign)
    db.flush()
    db.add_all(DisclosureRequest(tenant_id=company_id, campaign_id=campaign.id,
                          supplier_id=supplier.id, period=payload.period) for supplier in chosen)
    db.commit()
    return {"id": campaign.id, "request_count": len(chosen)}


def publish_supplier_data(db, row, report):
    supplier = db.query(Supplier).filter_by(id=row.supplier_id, company_id=row.tenant_id).with_for_update().one()
    submission = db.query(SupplierSubmission).filter_by(company_id=row.tenant_id, supplier_id=supplier.supplier_id,
                                                        period=row.period).first()
    old = submission.reported_emissions if submission else 0
    if submission is None:
        submission = SupplierSubmission(company_id=row.tenant_id, supplier_id=supplier.supplier_id, period=row.period)
        db.add(submission)
    submission.reported_emissions = float(report.emissions_kgco2e)
    submission.reported_intensity = float(report.intensity) if report.intensity is not None else None
    submission.note = f"定向披露 #{row.id} v{report.version_no}。{report.boundary}"[:512]
    db.flush()
    recent = db.query(SupplierSubmission).filter_by(company_id=row.tenant_id, supplier_id=supplier.supplier_id).order_by(
        SupplierSubmission.period.desc()).all()
    latest = recent[0]
    supplier.carbon_intensity = latest.reported_intensity
    supplier.annual_emissions = sum(item.reported_emissions for item in recent if item.period[:4] == latest.period[:4])
    quota = db.query(CarbonQuota).filter_by(company_id=row.tenant_id, supplier_id=supplier.supplier_id,
                                           year=int(row.period[:4])).with_for_update().first()
    if quota:
        quota.used_quota = round(max(0, quota.used_quota-old+submission.reported_emissions), 4)
    report.published_id = submission.id


@router.post("/{company_id}/{request_id}/review")
def review_task(company_id: int, request_id: int, payload: ReviewInput,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    row = db.query(DisclosureRequest).filter_by(id=request_id, tenant_id=company_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "没有该企业的报送任务")
    if row.status != "submitted":
        raise HTTPException(409, "请先刷新最新报送状态")
    report = db.query(SupplierEmissionData).filter_by(request_id=row.id).order_by(SupplierEmissionData.version_no.desc()).first()
    if report is None or report.version_no != payload.version_no:
        raise HTTPException(409, "报送版本已变更，请重新核对")
    if payload.decision == "approve":
        publish_supplier_data(db, row, report)
    report.state = row.status = "approved" if payload.decision == "approve" else "returned"
    report.reviewed_by, report.review_note = user.id, payload.note
    db.commit()
    return {"status": row.status, "revision": data_row(report)}
