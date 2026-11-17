"""排放因子路由。"""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import EmissionFactor, User
from ..schemas import FactorCreate

router = APIRouter(prefix="/factors", tags=["排放因子"])

_CATEGORY_SCOPE = {
    "diesel_combustion": "scope1",
    "electricity": "scope2",
    "electronic_components": "scope3",
    "pcb_materials": "scope3",
    "packaging_materials": "scope3",
}


def _to_dict(f: EmissionFactor) -> dict:
    return {
        "id": f.id, "factor_id": f.factor_id, "category": f.category, "scope": f.scope,
        "value": f.value, "unit": f.unit, "version": f.version, "origin": f.origin,
        "price_basis": f.price_basis, "is_demo": f.is_demo, "uncertainty_pct": f.uncertainty_pct,
        "description": f.description,
    }


@router.get("")
def list_factors(category: str | None = None, version: str | None = None, db: Session = Depends(get_db),
                 _: User = Depends(get_current_user)):
    q = db.query(EmissionFactor)
    if category:
        q = q.filter(EmissionFactor.category == category)
    if version:
        q = q.filter(EmissionFactor.version == version)
    return [_to_dict(f) for f in q.order_by(EmissionFactor.factor_id).all()]


@router.get("/sets")
def list_factor_sets(_: User = Depends(get_current_user)):
    """官方因子集：official-2022（全国）/ official-2022-hunan（湖南）/ official-2022-hz（华中）
    / official-2024-footprint（2024 碳足迹口径）。核算接口传 factor_set 即切换。"""
    from ..services.factor_library import FACTOR_SETS, OFFICIAL_FACTORS

    return {
        "sets": FACTOR_SETS,
        "official_factors": [
            {"factor_id": f["factor_id"], "category": f["category"], "value": f["value"],
             "unit": f["unit"], "origin": f["origin"], "uncertainty_pct": f["uncertainty_pct"]}
            for f in OFFICIAL_FACTORS
        ],
        "note": "Scope 3 采购类官方因子需由真实投入产出表推导（见 /calculations/eiolca/table 与 data/io/README.md）",
    }


@router.post("", status_code=201)
def create_factor(payload: FactorCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(EmissionFactor).filter(EmissionFactor.factor_id == payload.factor_id).first():
        raise HTTPException(status_code=400, detail="因子编号已存在")
    data = payload.model_dump()
    data["scope"] = payload.scope if payload.scope else _CATEGORY_SCOPE.get(payload.category, "scope3")
    f = EmissionFactor(**data)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _to_dict(f)


@router.get("/{factor_id}")
def get_factor(factor_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(EmissionFactor).filter(EmissionFactor.factor_id == factor_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _to_dict(f)


@router.post("/import", status_code=201)
async def import_factors(file: UploadFile = File(...), db: Session = Depends(get_db),
                         _: User = Depends(require_admin)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    for row in reader:
        fid = (row.get("factor_id") or "").strip()
        if not fid:
            continue
        category = (row.get("category") or "").strip()
        scope = _CATEGORY_SCOPE.get(category, "scope3")
        existing = db.query(EmissionFactor).filter(EmissionFactor.factor_id == fid).first()
        factor = existing or EmissionFactor(factor_id=fid, category=category, scope=scope)
        factor.category = category
        factor.scope = scope
        factor.value = float(row.get("value", 0))
        factor.unit = (row.get("unit") or "").strip()
        factor.version = (row.get("version") or "imported").strip()
        factor.origin = (row.get("origin") or "").strip()
        factor.price_basis = (row.get("price_basis") or "").strip() or None
        factor.is_demo = (row.get("is_demo", "true") or "true").lower() == "true"
        if existing is None:
            db.add(factor)
        created += 1
    db.commit()
    return {"imported": created}
