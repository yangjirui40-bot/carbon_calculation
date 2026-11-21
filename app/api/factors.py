"""排放因子路由。"""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin, tenant_company_id
from ..models import EmissionFactor, User
from ..services import factor_rows
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
def list_factors(category: str | None = None, version: str | None = None, company_id: int | None = None, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    q = factor_rows(db, tenant_company_id(user,company_id))
    if category:
        q = q.filter(EmissionFactor.category == category)
    if version:
        q = q.filter(EmissionFactor.version == version)
    return [_to_dict(f) for f, _ in q.order_by(EmissionFactor.factor_id).all()]


@router.get("/sets")
def list_factor_sets(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """官方因子集：official-2022（全国）/ official-2022-hunan（湖南）/ official-2022-hz（华中）
    / official-2024-footprint（2024 碳足迹口径）。核算接口传 factor_set 即切换。"""
    from ..services.factor_library import OFFICIAL_FACTORS
    from ..services.research_catalog import mappings

    return {
        "sets": mappings(db),
        "official_factors": [
            {"factor_id": f["factor_id"], "category": f["category"], "value": f["value"],
             "unit": f["unit"], "origin": f["origin"], "uncertainty_pct": f["uncertainty_pct"]}
            for f in OFFICIAL_FACTORS
        ],
        "note": "Scope 3 采购类可用真实投入产出表推导研究系数（非政府官方发布因子）（见 /calculations/eiolca/table 与 data/io/README.md）",
    }


@router.post("", status_code=201)
def create_factor(payload: FactorCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if payload.factor_id.startswith("TEN_") or db.query(EmissionFactor).filter(EmissionFactor.factor_id == payload.factor_id).first():
        raise HTTPException(status_code=400, detail="因子编号已存在")
    data = payload.model_dump()
    data["scope"] = payload.scope if payload.scope else _CATEGORY_SCOPE.get(payload.category, "scope3")
    f = EmissionFactor(**data)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _to_dict(f)


@router.get("/{factor_id}")
def get_factor(factor_id: str, company_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = factor_rows(db,tenant_company_id(user,company_id)).filter(EmissionFactor.factor_id == factor_id).first()
    f = row[0] if row else None
    if not f:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _to_dict(f)


@router.post("/derive-from-io")
def derive_scope3_from_io(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """由真实 42 部门表 + CEADs CO2 清单（g_2017.csv）推导研究型 Scope 3 采购因子。

    前置：data/io/io2017_42sector.csv（真实表，已就绪）与 data/io/g_2017.csv
    （CEADs 分行业 CO2 排放清单按 42 部门对齐，获取步骤见 data/io/README.md）。
    """
    from ..services.research_catalog import estimate, version
    from ..models.enterprise_controls import IoDerivationRun
    dataset = version(db)
    if dataset is None:
        raise HTTPException(422, "没有已登记并校验来源的投入产出数据集")
    categories = ["electronic_components", "pcb_materials", "packaging_materials"]
    run = estimate(db,dataset,{key:1 for key in categories})
    derived = {}
    for key, sector in run["mapping"].items():
        per_cny = run["f_kgco2e_per_cny"][run["sectors"].index(sector)]
        derived[key] = {"sector":sector,"f_kgco2e_per_wan":round(per_cny*10000,6),
                        "f_kgco2e_per_cny":round(per_cny,10)}
    inserted = []
    for category, d in derived.items():
        fid = f"CEADS_EEIO_{category.upper()}_2017"
        factor = db.query(EmissionFactor).filter(EmissionFactor.factor_id == fid).first()
        if factor is None:
            factor = EmissionFactor(factor_id=fid, category=category,
                                    scope=_CATEGORY_SCOPE.get(category, "scope3"))
            db.add(factor)
        factor.value = d["f_kgco2e_per_cny"]
        factor.unit = "kgCO2/CNY"
        factor.price_basis = "2017-CNY producer price; CO2-only"
        factor.version = "research-eiolca-2017"
        factor.origin = "CEADs 2017投入产出与CO2清单研究推导；非政府发布因子；CO2-only、2017年价格"
        factor.is_demo = False
        factor.uncertainty_pct = None
        factor.description = f"部门：{d['sector']}；完全排放强度 {d['f_kgco2e_per_wan']} kgCO2e/万元"
        inserted.append({**d, "factor_id": fid})
    event = IoDerivationRun(dataset_id=dataset.id,actor_id=_.id,result=inserted)
    db.add(event)
    db.commit()
    return {"derivation_id":event.id,"dataset_digest":dataset.digest,"derived": inserted, "method": "EEIO spend-based", "gas_coverage": "CO2-only", "price_year": 2017, "scope3_categories": ["purchased_goods_and_services"], "note": "研究推导系数；非政府官方发布值。未覆盖其他温室气体与全部15类Scope3；其他价格年度须另行换算。"}


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
        if fid.startswith("TEN_"):
            raise HTTPException(422,"企业版本需通过企业因子入口维护")
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
