"""Enterprise onboarding, employee invitations and organizational masters."""
import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, require_admin
from ..models import Company, Supplier, User
from ..models.base import utcnow
from ..models.organization import BoundaryMember, LegalEntity, OrgUnit, ReportingBoundary, Site, TenantInvite, TenantMember
from ..security import hash_password
from ..services.inventory import lock_company
from ..services.organization import boundary_snapshot, is_company_admin, require_company_admin

router = APIRouter(prefix="/organization", tags=["企业组织"])
Code = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Z0-9][A-Z0-9_-]{1,31}$")]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class LegalInput(BaseModel):
    code: Code
    legal_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
    jurisdiction: Name
    registration_no: str | None = Field(None, max_length=64)


class SiteInput(BaseModel):
    code: Code
    legal_entity_id: int
    name: Name
    region: Name


class UnitInput(BaseModel):
    code: Code
    site_id: int
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    kind: Literal["workshop", "line", "department"]
    parent_id: int | None = None


class BoundarySite(BaseModel):
    site_id: int
    share_ratio: Decimal = Field(default=Decimal(1), gt=0, le=1, max_digits=9, decimal_places=8)


class BoundaryInput(BaseModel):
    code: Code
    title: Name
    consolidation: Literal["operational_control", "financial_control", "equity_share"]
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1500)]
    sites: list[BoundarySite] = Field(min_length=1, max_length=400)


class InviteInput(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    role: Literal["enterprise", "auditor", "supplier"]
    supplier_id: int | None = None
    valid_days: int = Field(default=3, ge=1, le=14)


class AcceptInvite(BaseModel):
    token: Annotated[str, StringConstraints(min_length=32, max_length=96)]
    username: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$")]
    password: Annotated[str, StringConstraints(min_length=12, max_length=72)]


class MemberStatus(BaseModel):
    enabled: bool


def persist(db):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "编号、邮箱或业务记录已存在，请核对后重试") from exc


def fields(row, *keys):
    return {key: getattr(row, key) for key in keys}


@router.post("/accept", status_code=201)
def accept_invitation(payload: AcceptInvite, db: Session = Depends(get_db)):
    digest = hashlib.sha256(payload.token.encode()).hexdigest()
    invite = db.query(TenantInvite).filter_by(token_digest=digest).with_for_update().first()
    if not invite or invite.accepted_by or invite.revoked_at or invite.expires_at <= utcnow():
        raise HTTPException(410, "邀请已失效，请向企业管理员获取新邀请")
    if len(payload.password.encode()) > 72:
        raise HTTPException(422, "密码过长，请使用 12 至 72 个字节")
    if db.query(User.id).filter(func.lower(User.email) == invite.email).first():
        raise HTTPException(409, "此邮箱已有关联账号，请向企业管理员核对")
    supplier = db.get(Supplier, invite.supplier_id) if invite.supplier_id else None
    if invite.role == "supplier" and (supplier is None or supplier.company_id != invite.tenant_id):
        raise HTTPException(410, "供应商授权已失效，请联系企业管理员")
    account = User(username=payload.username, email=invite.email, hashed_password=hash_password(payload.password),
                   role=invite.role, company_id=invite.tenant_id, supplier_id=supplier.supplier_id if supplier else None)
    db.add(account)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "用户名或邮箱已使用") from exc
    db.add(TenantMember(tenant_id=invite.tenant_id, account_id=account.id, created_by=invite.created_by))
    invite.accepted_by = account.id
    persist(db)
    return {"username": account.username, "role": account.role}


@router.get("/{company_id}")
def list_organization(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    legal = db.query(LegalEntity).filter_by(tenant_id=company_id).order_by(LegalEntity.code).all()
    sites = db.query(Site).filter_by(tenant_id=company_id).order_by(Site.code).all()
    units = db.query(OrgUnit).filter_by(tenant_id=company_id).order_by(OrgUnit.code).all()
    return {"can_manage": is_company_admin(db, user, company_id),
            "legal_entities": [fields(row, "id", "code", "legal_name", "jurisdiction", "registration_no") for row in legal],
            "sites": [fields(row, "id", "code", "legal_entity_id", "name", "region") for row in sites],
            "org_units": [fields(row, "id", "code", "site_id", "parent_id", "name", "kind") for row in units]}


@router.get("/{company_id}/boundaries")
def list_boundaries(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    rows = db.query(ReportingBoundary).filter_by(tenant_id=company_id).order_by(ReportingBoundary.id.desc()).all()
    return [boundary_snapshot(db, row) for row in rows]


@router.post("/{company_id}/legal-entities", status_code=201)
def create_legal(company_id: int, payload: LegalInput,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    row = LegalEntity(tenant_id=company_id, **payload.model_dump())
    db.add(row)
    persist(db)
    return fields(row, "id", "code", "legal_name", "jurisdiction", "registration_no")


@router.post("/{company_id}/sites", status_code=201)
def create_site(company_id: int, payload: SiteInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    if not db.query(LegalEntity.id).filter_by(tenant_id=company_id, id=payload.legal_entity_id).first():
        raise HTTPException(422, "选择本企业的法人主体")
    row = Site(tenant_id=company_id, **payload.model_dump())
    db.add(row)
    persist(db)
    return fields(row, "id", "code", "legal_entity_id", "name", "region")


@router.post("/{company_id}/org-units", status_code=201)
def create_unit(company_id: int, payload: UnitInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    if not db.query(Site.id).filter_by(tenant_id=company_id, id=payload.site_id).first():
        raise HTTPException(422, "选择本企业的工厂")
    if payload.parent_id is not None:
        parent = db.query(OrgUnit).filter_by(tenant_id=company_id, id=payload.parent_id, site_id=payload.site_id).first()
        if parent is None or parent.kind != "workshop" or payload.kind != "line":
            raise HTTPException(422, "产线只能挂在本工厂下的车间")
    if payload.kind == "line" and payload.parent_id is None:
        raise HTTPException(422, "产线需要选择所属车间")
    row = OrgUnit(tenant_id=company_id, **payload.model_dump())
    db.add(row)
    persist(db)
    return fields(row, "id", "code", "site_id", "parent_id", "name", "kind")


@router.post("/{company_id}/boundaries", status_code=201)
def publish_boundary(company_id: int, payload: BoundaryInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    lock_company(db, company_id)
    ids = {site.site_id for site in payload.sites}
    if len(ids) != len(payload.sites) or db.query(Site).filter(Site.tenant_id == company_id, Site.id.in_(ids)).count() != len(ids):
        raise HTTPException(422, "盘查边界需选择互不重复的本企业工厂")
    if payload.consolidation != "equity_share" and any(site.share_ratio != 1 for site in payload.sites):
        raise HTTPException(422, "控制法按纳入工厂的全部活动量核算")
    version = db.query(func.max(ReportingBoundary.version_no)).filter_by(tenant_id=company_id, code=payload.code).scalar() or 0
    row = ReportingBoundary(tenant_id=company_id, published_by=user.id, version_no=version+1, **payload.model_dump(exclude={"sites"}))
    db.add(row)
    db.flush()
    db.add_all(BoundaryMember(tenant_id=company_id, boundary_id=row.id, **site.model_dump()) for site in payload.sites)
    persist(db)
    return boundary_snapshot(db, row)


def _members(db, company_id):
    owners = {member.account_id for member in db.query(TenantMember).filter_by(tenant_id=company_id, is_owner=True)}
    return [{**fields(row, "id", "username", "email", "role", "is_active"), "is_owner": row.id in owners}
            for row in db.query(User).filter_by(company_id=company_id).order_by(User.username)]


@router.get("/{company_id}/members")
def list_members(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    return _members(db, company_id)


@router.put("/{company_id}/members/{account_id}/owner")
def appoint_owner(company_id: int, account_id: int, db: Session = Depends(get_db), acting: User = Depends(require_admin)):
    lock_company(db, company_id)
    target = db.query(User).filter_by(id=account_id, company_id=company_id, role="enterprise", is_active=True).first()
    if not target:
        raise HTTPException(422, "只可为本企业有效员工开通企业管理权限")
    entry = db.query(TenantMember).filter_by(tenant_id=company_id, account_id=account_id).first()
    if not entry:
        entry = TenantMember(tenant_id=company_id, account_id=account_id, created_by=acting.id)
        db.add(entry)
    entry.is_owner = True
    persist(db)
    return {"is_owner": True}


@router.put("/{company_id}/members/{account_id}/status")
def set_member_status(company_id: int, account_id: int, payload: MemberStatus,
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    lock_company(db, company_id)
    account = db.query(User).filter_by(id=account_id, company_id=company_id).first()
    if not account or account.role == "admin":
        raise HTTPException(404, "没有此企业账号")
    if not payload.enabled and (account.id == user.id or is_company_admin(db, account, company_id)):
        raise HTTPException(409, "企业管理员需由平台管理员通过交接流程处理")
    account.is_active = payload.enabled
    persist(db)
    return {"id": account_id, "is_active": payload.enabled}


@router.get("/{company_id}/invites")
def invitations(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    rows = db.query(TenantInvite).filter_by(tenant_id=company_id).order_by(TenantInvite.id.desc()).limit(100)
    return [fields(row, "id", "email", "role", "expires_at", "revoked_at", "accepted_by") for row in rows]


@router.post("/{company_id}/invites", status_code=201)
def create_invitation(company_id: int, payload: InviteInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    lock_company(db, company_id)
    if db.get(Company, company_id) is None:
        raise HTTPException(404, "企业不存在")
    if payload.role == "supplier":
        partner = db.query(Supplier.id).filter_by(id=payload.supplier_id, company_id=company_id).first()
        if partner is None:
            raise HTTPException(422, "需选择当前企业的供应商档案")
    elif payload.supplier_id is not None:
        raise HTTPException(422, "仅供应商邀请可关联供应商档案")
    email = str(payload.email).lower()
    if db.query(User.id).filter(func.lower(User.email) == email).first():
        raise HTTPException(409, "该邮箱已经有关联账号")
    token = secrets.token_urlsafe(32)
    row = TenantInvite(tenant_id=company_id, created_by=user.id, email=email, role=payload.role,
                       supplier_id=payload.supplier_id, token_digest=hashlib.sha256(token.encode()).hexdigest(),
                       expires_at=utcnow()+timedelta(days=payload.valid_days))
    db.add(row)
    persist(db)
    return {"id": row.id, "token": token, "expires_at": row.expires_at}


@router.post("/{company_id}/invites/{invite_id}/revoke")
def revoke_invitation(company_id: int, invite_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_admin(db, user, company_id)
    row = db.query(TenantInvite).filter_by(tenant_id=company_id, id=invite_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "邀请不存在")
    if row.accepted_by:
        raise HTTPException(409, "邀请已使用，可以在成员列表中停用账号")
    if row.revoked_at is None:
        row.revoked_at = utcnow()
        persist(db)
    return {"revoked": True}
