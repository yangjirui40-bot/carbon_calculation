"""Scoped ERP pushes, credential rotation and batch receipts."""
import hashlib
import hmac
import json
import secrets
from uuid import uuid4
from ..crypto import store_secret
from ..models.enterprise_domains import StagedActivity, ImportRejection
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from ..database import authorize_tenant, get_db
from ..deps import get_current_user
from ..models import User
from ..models.base import utcnow
from ..models.ingestion import DataConnection, IngestBatch
from ..schemas import RecordCreate
from ..services.inventory import lock_company
from ..services.organization import require_company_admin
from .records import RecordSyncItem, _write_batch

router = APIRouter(prefix="/integrations", tags=["ERP 接入"])


class ConnectionInput(BaseModel):
    code: Annotated[str, StringConstraints(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,15}$")]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class ExternalItem(RecordSyncItem):
    site_code: str | None = Field(None,max_length=32)
    org_unit_code: str | None = Field(None,max_length=32)


class ExternalFeed(BaseModel):
    records: list[ExternalItem] = Field(min_length=1,max_length=1000)


def public_row(row):
    return {"id":row.id,"code":row.code,"name":row.name,"revoked_at":row.revoked_at,
            "feed_path":f"/api/v1/integrations/feed/{row.id}"}


def new_credential():
    raw = "cs_" + secrets.token_urlsafe(32)
    return raw,hashlib.sha256(raw.encode()).hexdigest()


@router.get("/{company_id}")
def connections(company_id: int, db:Session = Depends(get_db), user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    rows = db.query(DataConnection).filter_by(tenant_id=company_id).order_by(DataConnection.code)
    return [public_row(row) for row in rows]


@router.post("/{company_id}",status_code=201)
def create_connection(company_id: int, payload:ConnectionInput, db:Session=Depends(get_db), user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    lock_company(db,company_id)
    if db.query(DataConnection.id).filter_by(tenant_id=company_id,code=payload.code).first():
        raise HTTPException(409,"接入编码已存在")
    raw,digest = new_credential()
    data=DataConnection(tenant_id=company_id,created_by=user.id,token_digest=digest,**payload.model_dump())
    db.add(data);db.commit()
    return {**public_row(data),"token":raw}


def find_connection(db, company_id, connection_id):
    value=db.query(DataConnection).filter_by(tenant_id=company_id,id=connection_id).first()
    if not value:
        raise HTTPException(404,"接入不存在")
    return value


@router.post("/{company_id}/{connection_id}/rotate")
def rotate(company_id:int,connection_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    lock_company(db,company_id)
    value=find_connection(db,company_id,connection_id)
    raw,value.token_digest=new_credential();value.revoked_at=None;value.created_by=user.id
    db.commit()
    return {**public_row(value),"token":raw}


@router.post("/{company_id}/{connection_id}/revoke")
def revoke(company_id:int,connection_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    lock_company(db,company_id)
    value=find_connection(db,company_id,connection_id)
    if value.revoked_at is None:
        value.revoked_at=utcnow();db.commit()
    return public_row(value)


@router.get("/{company_id}/{connection_id}/batches")
def batches(company_id:int,connection_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    value=find_connection(db,company_id,connection_id)
    return [{"id":batch.id,"request_key":batch.request_key,"created_at":batch.created_at,"rows":batch.rows,
             "imported":batch.imported,"skipped":batch.skipped} for batch in db.query(IngestBatch)
            .filter_by(connection_id=value.id).order_by(IngestBatch.id.desc()).limit(100)]


@router.post("/feed/{connection_id}",status_code=201)
def push_feed(connection_id:int, payload:ExternalFeed,
              authorization:Annotated[str,Header(max_length=100)],
              idempotency_key:Annotated[str,Header(min_length=6,max_length=72,pattern=r"^[a-zA-Z0-9._-]+$")],
              db:Session=Depends(get_db)):
    scheme, _, secret=authorization.partition(" ")
    if scheme.lower()!="bearer" or not secret.startswith("cs_"):
        raise HTTPException(401,"无效接入凭证")
    value=db.get(DataConnection,connection_id)
    if not value:
        raise HTTPException(401,"无效接入凭证")
    lock_company(db,value.tenant_id)
    db.refresh(value)
    digest=hashlib.sha256(secret.encode()).hexdigest()
    if value.revoked_at or not hmac.compare_digest(digest,value.token_digest):
        raise HTTPException(401,"接入凭证已失效")
    actor=db.get(User,value.created_by)
    try:
        if not actor or not actor.is_active:
            raise HTTPException(403,"邀请人权限失效")
        require_company_admin(db,actor,value.tenant_id)
    except HTTPException as exc:
        raise HTTPException(401,"接入授权已失效") from exc
    authorize_tenant(db, value.tenant_id, "enterprise")
    signature=hashlib.sha256(json.dumps(payload.model_dump(mode="json"),sort_keys=True).encode()).hexdigest()
    previous=db.query(IngestBatch).filter_by(connection_id=value.id,request_key=idempotency_key).first()
    if previous:
        if not hmac.compare_digest(previous.payload_hash,signature):
            raise HTTPException(409,"同一请求键已被不同内容使用")
        return {"batch_id":previous.id,"total_rows":previous.rows,"imported":previous.imported,
                "skipped":previous.skipped,"replayed":True}

    def source(codes):
        for row in payload.records:
            data=row.model_dump(exclude={"site_code","org_unit_code"})
            site_id=codes[0].get(row.site_code.strip().upper()) if row.site_code else row.site_id
            org_id=codes[1].get((site_id,row.org_unit_code.strip().upper())) if row.org_unit_code else row.org_unit_id
            if (row.site_code and not site_id) or (row.org_unit_code and not org_id):
                raise ValueError("接入记录中的工厂或组织编码无效")
            if (row.site_code and row.site_id not in (None,site_id)) or (row.org_unit_code and row.org_unit_id not in (None,org_id)):
                raise ValueError("接入记录的组织编号与编码冲突")
            data.update(site_id=site_id,org_unit_id=org_id,record_no=f"C{value.tenant_id}-{value.code}-{row.record_no.strip()}")
            yield RecordCreate(**data,company_id=value.tenant_id,review_status="pending",source="api")
    cid, connection_key, actor_id=value.tenant_id,value.id,actor.id
    try:
        result=_write_batch(db,cid,actor_id,source,compare=True,defer_commit=True)
    except HTTPException as exc:
        # A rejected request must stay retryable under its original idempotency key.
        db.rollback()
        lock_company(db,cid)
        rejected=IngestBatch(connection_id=connection_key,request_key="reject:"+uuid4().hex,payload_hash=signature,
                             rows=len(payload.records),imported=0,skipped=0)
        db.add(rejected)
        db.flush()
        db.add(ImportRejection(tenant_id=cid,batch_id=rejected.id,kv_row=idempotency_key,reason_code=str(exc.status_code),
                               detail=str(exc.detail)[:1000],created_at=utcnow()))
        db.commit()
        raise
    batch=IngestBatch(connection_id=value.id,request_key=idempotency_key,payload_hash=signature,
                      rows=result["total_rows"],imported=result["imported"],skipped=result["skipped"])
    db.add(batch)
    db.flush()
    db.add_all(StagedActivity(tenant_id=cid,batch_id=batch.id,source_record_key=item.record_no,line_no=i,
                              payload=store_secret(item.model_dump(mode="json")),state="accepted")
               for i,item in enumerate(payload.records,1))
    db.commit()
    return {**result,"batch_id":batch.id,"replayed":False}


@router.get("/{company_id}/{connection_id}/batches/{batch_id}")
def batch_detail(company_id:int,connection_id:int,batch_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    find_connection(db,company_id,connection_id)
    if not db.query(IngestBatch.id).filter_by(id=batch_id,connection_id=connection_id).first():
        raise HTTPException(404,"批次不存在")
    rows=db.query(StagedActivity).filter_by(tenant_id=company_id,batch_id=batch_id).order_by(StagedActivity.line_no)
    failures=db.query(ImportRejection).filter_by(tenant_id=company_id,batch_id=batch_id).order_by(ImportRejection.id)
    return {"rows":[{"line":v.line_no,"source_record_key":v.source_record_key,"state":v.state} for v in rows],
            "rejections":[{"request_key":v.kv_row,"reason":v.detail,"code":v.reason_code} for v in failures]}
