"""企业路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Company, User
from ..schemas import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["企业"])


def _to_dict(c: Company) -> dict:
    return {
        "id": c.id, "code": c.code, "name": c.name, "industry": c.industry,
        "region": c.region, "scale": c.scale, "contact_name": c.contact_name,
        "contact_phone": c.contact_phone, "contact_email": c.contact_email,
        "description": c.description, "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("", status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db),
                   _: User = Depends(require_admin)):
    if db.query(Company).filter(Company.code == payload.code).first():
        raise HTTPException(status_code=400, detail="企业编号已存在")
    c = Company(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_dict(c)


@router.get("")
def list_companies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Company).order_by(Company.id)
    if user.role != "admin":
        q = q.filter(Company.id == user.company_id)  # 租户隔离：企业用户仅可见本企业
    return [_to_dict(c) for c in q.all()]


@router.get("/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="企业不存在")
    from ..deps import check_company_access
    check_company_access(db, user, company_id)
    return _to_dict(c)


@router.put("/{company_id}")
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db),
                   _: User = Depends(require_admin)):
    c = db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="企业不存在")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _to_dict(c)


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    c = db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="企业不存在")
    db.delete(c)
    db.commit()
