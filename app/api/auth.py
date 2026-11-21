"""认证路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import User, Company
from ..config import settings
import uuid
from ..schemas import Token, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(payload: UserCreate, db: Session = Depends(get_db),
                      _: User = Depends(require_admin)):
    """管理员创建任意角色账号（如供应商门户账号）。"""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="邮箱已存在")
    if payload.role not in ("admin", "enterprise", "auditor", "supplier"):
        raise HTTPException(status_code=422, detail="无效角色")
    if payload.company_id is not None and db.get(Company, payload.company_id) is None:
        raise HTTPException(status_code=422, detail="企业不存在")
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        company_id=payload.company_id,
        supplier_id=payload.supplier_id if hasattr(payload, "supplier_id") else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if not settings.SELF_REGISTRATION_ENABLED:
        raise HTTPException(status_code=403, detail="请联系管理员开通企业账号")
    if payload.company_id is not None or payload.supplier_id is not None:
        raise HTTPException(status_code=403, detail="加入现有企业或供应商须由管理员授权")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="邮箱已存在")
    # 自助注册仅限企业用户角色；管理员/审计师由管理员创建
    role = payload.role
    if role != "enterprise":
        raise HTTPException(status_code=403, detail="自助注册仅限企业用户角色")
    if payload.role not in ("admin", "enterprise", "auditor", "supplier"):
        raise HTTPException(status_code=422, detail="无效角色")
    if payload.company_id is not None and db.get(Company, payload.company_id) is None:
        raise HTTPException(status_code=422, detail="企业不存在")
    company = Company(code="tenant-" + uuid.uuid4().hex[:20], name=payload.company_name or payload.username + "的企业")
    db.add(company)
    db.flush()
    user = User(
        username=payload.username, email=payload.email,
        hashed_password=hash_password(payload.password), role=role, company_id=company.id,
    )
    db.add(user)
    db.flush()
    from ..models.organization import TenantMember
    db.add(TenantMember(tenant_id=company.id, account_id=user.id, is_owner=True))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已停用")
    token = create_access_token(str(user.id), {"role": user.role, "username": user.username})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
