"""FastAPI 依赖：数据库会话、当前用户解析与多租户/角色访问控制。"""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .security import JWTError, decode_access_token
from .models import User

ROLE_ADMIN = "admin"
ROLE_ENTERPRISE = "enterprise"
ROLE_SUPPLIER = "supplier"
ROLE_AUDITOR = "auditor"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效或过期的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise credentials_error
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error
    try:
        user = db.get(User, int(user_id))
    except (TypeError, ValueError):
        raise credentials_error
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


def require_roles(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要权限：{'/'.join(roles)}",
            )
        return current_user

    return dependency


def check_company_access(db: Session, user: User, company_id: int | None, write: bool = False) -> None:
    """多租户隔离：管理员不受限；审计师只读；企业用户仅限本企业。"""
    if company_id is None:
        return
    if user.role == ROLE_ADMIN:
        return
    if user.role == ROLE_AUDITOR and not write:
        return
    if user.company_id == company_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="无权访问该企业数据（租户隔离）",
    )


def tenant_company_id(user: User, requested: int | None) -> int | None:
    """非管理员请求其他企业数据时直接拒绝，返回其归属企业。"""
    if user.role == ROLE_ADMIN:
        return requested
    if requested is not None and requested != user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该企业数据（租户隔离）")
    return user.company_id
