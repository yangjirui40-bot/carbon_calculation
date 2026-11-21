"""Assign inventory collection and track remediation before a monthly submission."""
from datetime import date
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import SourceDocument, User
from ..models.base import utcnow
from ..models.enterprise_controls import PeriodResponsibility, QualityIssue
from ..models.organization import Site
from ..services.inventory import lock_company
from ..services.organization import is_company_admin, require_period_location
from .inventory import assignment, log, require_period

router = APIRouter(prefix="/period-work", tags=["盘查任务与整改"])
Kind = Literal["collection", "quality"]
models = {"collection": PeriodResponsibility, "quality": QualityIssue}
Text = Annotated[str,StringConstraints(strip_whitespace=True,min_length=2,max_length=500)]


class NewWork(BaseModel):
    title: Annotated[str,StringConstraints(strip_whitespace=True,min_length=2,max_length=160)]
    site_id: int
    owner_id: int
    due_date: date
    severity: Literal["advisory","blocking"] = "blocking"


class Review(BaseModel):
    version: int = Field(ge=1)
    action: Literal["submit","accept","return"]
    note: Text
    evidence_id: int | None = None


def access(db,user,cid,month,write=False):
    check_company_access(db,user,cid,write=write)
    if write:
        lock_company(db,cid)
    period = require_period(db,cid,month)
    if write and period.status != "open":
        raise HTTPException(409,"请先在盘查审批中退回或重开此月份")
    return period


def can_assign(db,user,cid):
    return is_company_admin(db,user,cid) or assignment(db,cid,user.id) == "coordinator"


@router.get("/{cid}/{month}")
def worklist(cid:int,month:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    period = access(db,user,cid,month)
    manager = can_assign(db,user,cid)
    reviewer = assignment(db,cid,user.id) == "reviewer"
    result = []
    for kind, model in models.items():
        for row,site,owner in db.query(model,Site.name,User.username).join(Site,Site.id==model.site_id).join(
            User,User.id==model.owner_id).filter(model.period_id==period.id,model.company_id==cid).order_by(model.due_date,model.id):
            result.append({"kind":kind, "id":row.id, "site":site, "owner":owner, "title":row.title, "due_date":row.due_date,
                           "state":row.state, "version":row.version, "severity":getattr(row,"severity","blocking"),
                           "resolution":row.resolution,"evidence_id":row.evidence_id,
                           "can_submit":period.status=="open" and row.state=="open" and row.owner_id==user.id,
                           "can_verify":period.status=="open" and row.state=="submitted" and reviewer and row.owner_id!=user.id})
    owners = db.query(User).filter_by(company_id=cid,role="enterprise",is_active=True).order_by(User.username) if manager else []
    return {"can_assign":manager and period.status=="open", "items":result, "owners":[{"id":u.id,"name":u.username} for u in owners]}


@router.post("/{cid}/{month}/{kind}",status_code=201)
def add(cid:int,month:str,kind:Kind,p:NewWork,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    period = access(db,user,cid,month,True)
    if not can_assign(db,user,cid):
        raise HTTPException(403,"请由企业管理员或盘查负责人分派")
    if not db.query(Site.id).filter_by(tenant_id=cid,id=p.site_id).first():
        raise HTTPException(422,"工厂不属于此企业")
    require_period_location(db,cid,month,p.site_id)
    if not db.query(User.id).filter_by(id=p.owner_id,company_id=cid,role="enterprise",is_active=True).first():
        raise HTTPException(422,"请选择有效的企业责任人")
    if assignment(db,cid,p.owner_id) == "reviewer":
        raise HTTPException(422,"复核岗位须与采集整改岗位分开")
    fields = p.model_dump(exclude={"severity"})
    if kind == "quality":
        fields["severity"] = p.severity
    row = models[kind](company_id=cid,period_id=period.id,opened_by=user.id,**fields)
    db.add(row)
    db.flush()
    from ..services.domain_registry import notify_member
    notify_member(db,cid,row.owner_id,"work_open",f"{kind}-{row.id}",f"{month} · 待处理：{row.title}")
    log(db,period,user,"work_open",f"{kind} #{row.id} {row.title}")
    db.commit()
    return {"id":row.id,"version":row.version}


@router.post("/{cid}/{month}/{kind}/{work_id}")
def transition(cid:int,month:str,kind:Kind,work_id:int,p:Review,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    period = access(db,user,cid,month,True)
    row = db.query(models[kind]).filter_by(id=work_id,company_id=cid,period_id=period.id).first()
    if not row:
        raise HTTPException(404,"任务不存在")
    if row.version != p.version:
        raise HTTPException(409,"任务版本已变更，请刷新")
    if p.action == "submit":
        if row.owner_id != user.id or assignment(db,cid,user.id) == "reviewer":
            raise HTTPException(403,"需由指定的采集整改责任人提交")
        if row.state != "open":
            raise HTTPException(409,"只有待处理任务可以提交")
        if p.evidence_id and not db.query(SourceDocument.id).filter_by(id=p.evidence_id,company_id=cid).filter(SourceDocument.doc_type!="revenue_evidence").first():
            raise HTTPException(422,"请选择本企业凭证")
        row.state,row.resolution,row.evidence_id = "submitted",p.note,p.evidence_id
    else:
        if assignment(db,cid,user.id) != "reviewer" or user.id == row.owner_id:
            raise HTTPException(403,"需要独立盘查复核人")
        if row.state != "submitted":
            raise HTTPException(409,"任务尚未提交复核")
        row.state,row.reviewed_by,row.reviewed_at = ("closed" if p.action=="accept" else "open"),user.id,utcnow()
    row.version += 1
    if p.action != "submit":
        from ..services.domain_registry import notify_member
        label = "复核通过" if p.action=="accept" else "退回补充"
        notify_member(db,cid,row.owner_id,"work_review",f"{kind}-{row.id}-v{row.version}",f"{month} · {label}：{row.title}")
    log(db,period,user,"work_"+p.action,f"{kind} #{row.id} {p.note}")
    db.commit()
    return {"id":row.id,"state":row.state,"version":row.version}


@router.get("/{cid}/inbox/messages")
def inbox(cid:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    from ..models.enterprise_domains import NotificationDelivery
    from ..models.organization import TenantMember
    check_company_access(db,user,cid)
    rows=db.query(NotificationDelivery).join(TenantMember,TenantMember.id==NotificationDelivery.recipient_id).filter(
        TenantMember.account_id==user.id,TenantMember.tenant_id==cid,NotificationDelivery.tenant_id==cid)
    return [{"id":v.id,"message":v.message,"delivered":v.sent_at,"read":v.read_at} for v in rows.order_by(NotificationDelivery.id.desc()).limit(100)]


@router.post("/{cid}/inbox/messages/{entry_id}/read")
def acknowledge(cid:int,entry_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    from ..models.enterprise_domains import NotificationDelivery
    from ..models.organization import TenantMember
    check_company_access(db,user,cid,write=True)
    entry=db.query(NotificationDelivery).join(TenantMember,TenantMember.id==NotificationDelivery.recipient_id).filter(
        TenantMember.account_id==user.id,TenantMember.tenant_id==cid,NotificationDelivery.tenant_id==cid,NotificationDelivery.id==entry_id).first()
    if not entry:
        raise HTTPException(404,"消息不存在")
    if not entry.read_at:
        entry.read_at=utcnow()
        db.commit()
    return {"id":entry_id,"read":entry.read_at}
