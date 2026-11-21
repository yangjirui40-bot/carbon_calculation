"""Controlled preparation and release of internally approved evidence for a named recipient."""
import hashlib
import io
import json
from datetime import timedelta, timezone
from decimal import Decimal
from zipfile import ZipFile, ZIP_DEFLATED
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import Report, User, SourceDocument
from ..models.base import utcnow
from ..models.enterprise_controls import RawObject
from ..models.enterprise_domains import AssuranceEngagement, FinanceAssessment, FinanceMetricResult, ReportRelease
from ..models.inventory import InventoryPeriod
from ..services.inventory import lock_company
from ..services.organization import is_company_admin, require_company_admin
from ..services.report_archive import list_metadata, read_artifact

router=APIRouter(prefix="/evidence-delivery",tags=["核证与融资材料"])
Label=Annotated[str,StringConstraints(strip_whitespace=True,min_length=2,max_length=160)]


class Recipient(BaseModel):
    name: Label
    purpose: Literal["verifier","finance"]
    scope: Annotated[str,StringConstraints(strip_whitespace=True,min_length=4,max_length=500)]
    days: int = Field(ge=1,le=90)


class Revenue(BaseModel):
    revenue_cny: Decimal = Field(gt=0,max_digits=20,decimal_places=2)
    proof_id: int


def report_for(db,user,number,write=False):
    row=db.query(Report).filter_by(report_no=number).first()
    if not row:
        raise HTTPException(404,"报告不存在")
    check_company_access(db,user,row.company_id)
    if write:
        require_company_admin(db,user,row.company_id)
        lock_company(db,row.company_id)
    return row


def assert_current(db,report):
    approved=(report.content or {}).get("internal_approval") or {}
    current=db.query(InventoryPeriod.id).filter_by(company_id=report.company_id,run_id=report.run_id,status="closed",
                 revision=approved.get("revision"),period=approved.get("period")).first()
    if report.report_type!="ISO14064" or not current or len(list_metadata(db,report))!=2:
        raise HTTPException(409,"请先生成当前关账版本的盘查报告并完成 PDF 与 XML 归档")
    if not db.get(ReportRelease,report.id):
        raise HTTPException(409,"报告发行记录尚未建立")


def is_expired(end):
    return (end if end.tzinfo else end.replace(tzinfo=timezone.utc)) <= utcnow()


def metrics(db,entry):
    return [{"code":m.metric_code,"value":m.measure,"unit":m.unit,"proof_id":m.proof_id}
            for m in db.query(FinanceMetricResult).filter_by(assessment_id=entry.id,tenant_id=entry.tenant_id).order_by(FinanceMetricResult.id)]


@router.get("/{number}")
def status(number:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    r=report_for(db,user,number)
    try:
        assert_current(db,r)
        current=True
    except HTTPException as exc:
        if exc.status_code!=409:
            raise
        current=False
    manage=is_company_admin(db,user,r.company_id)
    if not manage and user.role!="auditor":
        return {"company_id":r.company_id,"can_manage":False,"current":False,"recipients":[],"assessments":[]}
    prepared=db.query(AssuranceEngagement).filter_by(tenant_id=r.company_id,release_id=r.id).order_by(AssuranceEngagement.id.desc())
    sheets=db.query(FinanceAssessment).filter_by(tenant_id=r.company_id,release_id=r.id).order_by(FinanceAssessment.id.desc())
    return {"company_id":r.company_id,"can_manage":is_company_admin(db,user,r.company_id),"current":current,
            "recipients":[{"id":v.id,"name":v.recipient_label,"purpose":v.recipient_type,"scope":v.scope_note,
               "expires":v.validity_end,"state":"revoked" if v.revoked_at else "expired" if is_expired(v.validity_end) else v.state} for v in prepared],
            "assessments":[{"id":v.id,"metrics":metrics(db,v)} for v in sheets]}


@router.post("/{number}/recipients",status_code=201)
def prepare(number:str,p:Recipient,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    r=report_for(db,user,number,True)
    assert_current(db,r)
    sheet_id=None
    if p.purpose=="finance":
        sheet_id=db.query(FinanceAssessment.id).filter_by(tenant_id=r.company_id,release_id=r.id).order_by(FinanceAssessment.id.desc()).limit(1).scalar()
        if sheet_id is None:
            raise HTTPException(409,"请先编制该关账报告的融资材料底稿")
    entry=AssuranceEngagement(prepared_finance_id=sheet_id,tenant_id=r.company_id,release_id=r.id,recipient_type=p.purpose,
         recipient_label=p.name,scope_note=p.scope,state="prepared",created_by=user.id,validity_end=utcnow()+timedelta(days=p.days))
    db.add(entry)
    db.commit()
    return {"id":entry.id}


@router.post("/{number}/finance",status_code=201)
def finance(number:str,p:Revenue,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    r=report_for(db,user,number,True)
    assert_current(db,r)
    if not db.query(RawObject).join(SourceDocument,SourceDocument.id==RawObject.document_id).filter(
        RawObject.document_id==p.proof_id,SourceDocument.company_id==r.company_id,SourceDocument.doc_type=="revenue_evidence").first():
        raise HTTPException(422,"请上传本企业当期营业收入底稿并选用其档案编号")
    approval=r.content["internal_approval"]
    entry=FinanceAssessment(tenant_id=r.company_id,release_id=r.id,created_by=user.id,
           evaluation_profile="closed-period-intensity-v1",scored_at=utcnow(),state="internal_workpaper")
    db.add(entry)
    db.flush()
    total=Decimal(str(r.content["total_kgco2e"]))
    values=[("period_emissions",total,"kgCO2e"),("reported_period_revenue",p.revenue_cny,"CNY"),
            ("carbon_intensity_per_10000_cny",total*10000/p.revenue_cny,"kgCO2e/10000CNY")]
    for code,value,unit in values:
        db.add(FinanceMetricResult(tenant_id=r.company_id,assessment_id=entry.id,metric_code=code,measure=value,
                                   proof_id=p.proof_id if "revenue" in code or "intensity" in code else None,unit=unit))
    db.commit()
    return {"id":entry.id,"period":approval["period"],"metrics":metrics(db,entry)}


def recipient(db,report,entry_id):
    row=db.query(AssuranceEngagement).filter_by(release_id=report.id,tenant_id=report.company_id,id=entry_id).first()
    if not row:
        raise HTTPException(404,"交付授权不存在")
    return row


@router.post("/{number}/{entry_id}/revoke")
def revoke(number:str,entry_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    report=report_for(db,user,number,True)
    entry=recipient(db,report,entry_id)
    if not entry.revoked_at:
        entry.revoked_at,entry.state=utcnow(),"revoked"
        db.commit()
    return {"state":"revoked"}


@router.post("/{number}/{entry_id}/package")
def package(number:str,entry_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    report=report_for(db,user,number,True)
    entry=recipient(db,report,entry_id)
    assert_current(db,report)
    if entry.revoked_at or is_expired(entry.validity_end):
        raise HTTPException(410,"本次材料导出授权已过期或撤销")
    manifest={"report":number,"recipient":entry.recipient_label,"purpose":entry.recipient_type,"scope":entry.scope_note,
              "source_run":report.run_id,"approval":report.content["internal_approval"],"files":{}}
    output=io.BytesIO()
    with ZipFile(output,"w",compression=ZIP_DEFLATED) as z:
        for fmt in ("pdf","xml"):
            body,digest,archived=read_artifact(db,report,fmt)
            if not archived:
                raise HTTPException(409,"缺少固定归档")
            name=number+"."+fmt
            z.writestr(name,body)
            manifest["files"][name]=digest
        if entry.recipient_type=="finance":
            sheet=db.query(FinanceAssessment).filter_by(id=entry.prepared_finance_id,tenant_id=report.company_id,release_id=report.id).first()
            if not sheet:
                raise HTTPException(409,"请先编制该关账报告的融资材料底稿")
            body=json.dumps({"assessment_id":sheet.id,"source":sheet.evaluation_profile,"metrics":metrics(db,sheet)},
                            default=str,ensure_ascii=False,indent=2).encode()
            z.writestr("finance.json",body)
            manifest["files"]["finance.json"]=hashlib.sha256(body).hexdigest()
        z.writestr("manifest.json",json.dumps(manifest,ensure_ascii=False,indent=2))
    entry.downloaded_at,entry.state=utcnow(),"exported"
    db.commit()
    return Response(output.getvalue(),media_type="application/zip",headers={
        "Content-Disposition":f'attachment; filename="{number}-delivery-{entry.id}.zip"',"Cache-Control":"private, no-store"})
