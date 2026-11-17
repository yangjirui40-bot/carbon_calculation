"""OLAP 层：星型模型 ETL 刷新与聚合查询（供驾驶舱使用）。"""
from __future__ import annotations

from collections import defaultdict

from ..models import (
    BusinessRecord,
    Company,
    DimCategory,
    DimCompany,
    DimPeriod,
    DimSupplier,
    EmissionFactor,
    FactCompanyEmission,
    FactEmission,
    Supplier,
)
from . import load_factors_from_db

_CATEGORY_SCOPE = {
    "diesel_combustion": "scope1",
    "electricity": "scope2",
    "electronic_components": "scope3",
    "pcb_materials": "scope3",
    "packaging_materials": "scope3",
}


def refresh_olap(db) -> dict:
    """全量重建星型模型（维度 upsert + 事实表重建）。"""
    factors = load_factors_from_db(db)

    # 维度 upsert
    company_keys = {}
    for c in db.query(Company).all():
        dim = db.query(DimCompany).filter(DimCompany.company_id == c.id).first()
        if dim is None:
            dim = DimCompany(company_id=c.id, code=c.code, name=c.name,
                             industry=c.industry, region=c.region)
            db.add(dim)
            db.flush()
        else:
            dim.code, dim.name, dim.industry, dim.region = c.code, c.name, c.industry, c.region
        company_keys[c.id] = dim.company_key

    period_keys = {}
    for (period,) in db.query(BusinessRecord.period).distinct().all():
        dim = db.query(DimPeriod).filter(DimPeriod.period == period).first()
        if dim is None:
            y, m = (period.split("-") + ["1", "1"])[:2]
            dim = DimPeriod(period=period, year=int(y or 1970), month=int(m or 1))
            db.add(dim)
            db.flush()
        period_keys[period] = dim.period_key

    category_keys = {}
    categories = {f.category: f for f in db.query(EmissionFactor).all()}
    for category, f in categories.items():
        dim = db.query(DimCategory).filter(DimCategory.category == category).first()
        if dim is None:
            dim = DimCategory(category=category, scope=_CATEGORY_SCOPE.get(category, "scope3"))
            db.add(dim)
            db.flush()
        category_keys[category] = dim.category_key

    supplier_keys = {}
    for s in db.query(Supplier).all():
        dim = db.query(DimSupplier).filter(DimSupplier.supplier_id == s.supplier_id).first()
        if dim is None:
            dim = DimSupplier(supplier_id=s.supplier_id, name=s.name, industry=s.industry,
                              region=s.region, tier=s.tier)
            db.add(dim)
            db.flush()
        supplier_keys[s.supplier_id] = dim.supplier_key

    # 事实表重建
    db.query(FactEmission).delete()
    db.query(FactCompanyEmission).delete()
    agg: dict[tuple, dict] = defaultdict(lambda: {"s1": 0.0, "s2": 0.0, "s3": 0.0, "n": 0})

    for r in db.query(BusinessRecord).filter(BusinessRecord.review_status == "confirmed").all():
        factor = factors.get(r.factor_id)
        if factor is None:
            continue
        ef = float(factor["value"])
        if r.scope in ("scope1", "scope2") and r.quantity:
            e = r.quantity * ef
            activity, amount = r.quantity, None
        elif r.scope == "scope3" and r.amount:
            e = r.amount * ef
            activity, amount = None, r.amount
        else:
            continue
        db.add(FactEmission(
            company_key=company_keys.get(r.company_id),
            period_key=period_keys.get(r.period),
            category_key=category_keys.get(r.category),
            supplier_key=None,
            record_no=r.record_no,
            activity_qty=activity,
            amount_cny=amount,
            emissions_kgco2e=round(e, 8),
            factor_id=r.factor_id,
            factor_version=factor.get("version"),
            is_demo=bool(factor.get("is_demo", True)),
        ))
        key = (company_keys.get(r.company_id), period_keys.get(r.period))
        a = agg[key]
        a["s1" if r.scope == "scope1" else "s2" if r.scope == "scope2" else "s3"] += e
        a["n"] += 1

    for (ck, pk), a in agg.items():
        total = a["s1"] + a["s2"] + a["s3"]
        db.add(FactCompanyEmission(company_key=ck, period_key=pk,
                                   scope1=round(a["s1"], 6), scope2=round(a["s2"], 6),
                                   scope3=round(a["s3"], 6), total=round(total, 6),
                                   record_count=a["n"]))
    db.commit()
    return {"fact_emission_rows": db.query(FactEmission).count(),
            "fact_company_emission_rows": db.query(FactCompanyEmission).count()}


# ---------- 星型聚合查询（驾驶舱数据源） ----------

def star_summary(db, company_id: int) -> dict | None:
    dim = db.query(DimCompany).filter(DimCompany.company_id == company_id).first()
    if dim is None:
        return None
    row = (db.query(FactCompanyEmission, DimPeriod)
           .join(DimPeriod, FactCompanyEmission.period_key == DimPeriod.period_key)
           .filter(FactCompanyEmission.company_key == dim.company_key)
           .order_by(DimPeriod.period.desc()).first())
    if row is None:
        return None
    f, p = row
    return {"period": p.period, "total_kgco2e": f.total,
            "scope_breakdown": {"scope1": f.scope1, "scope2": f.scope2, "scope3": f.scope3}}


def star_ring(db, company_id: int) -> list[dict] | None:
    dim = db.query(DimCompany).filter(DimCompany.company_id == company_id).first()
    if dim is None:
        return None
    latest = (db.query(FactCompanyEmission)
              .filter(FactCompanyEmission.company_key == dim.company_key)
              .order_by(FactCompanyEmission.period_key.desc()).first())
    if latest is None:
        return None
    rows = (db.query(DimCategory, FactEmission)
            .join(FactEmission, FactEmission.category_key == DimCategory.category_key)
            .filter(FactEmission.company_key == dim.company_key,
                    FactEmission.period_key == latest.period_key).all())
    return [{"category": c.category, "scope": c.scope,
             "emissions_kgco2e": round(sum(x.emissions_kgco2e for _, x in rows if x.category_key == c.category_key), 6)}
            for c, _ in rows]


def star_trend(db, company_id: int) -> list[dict] | None:
    dim = db.query(DimCompany).filter(DimCompany.company_id == company_id).first()
    if dim is None:
        return None
    rows = (db.query(FactCompanyEmission, DimPeriod)
            .join(DimPeriod, FactCompanyEmission.period_key == DimPeriod.period_key)
            .filter(FactCompanyEmission.company_key == dim.company_key)
            .order_by(DimPeriod.period).all())
    if not rows:
        return None
    return [{"period": p.period, "scope1": f.scope1, "scope2": f.scope2,
             "scope3": f.scope3, "total": f.total} for f, p in rows]


def star_drilldown(db, company_id: int) -> dict | None:
    dim = db.query(DimCompany).filter(DimCompany.company_id == company_id).first()
    if dim is None:
        return None
    rows = (db.query(FactEmission, DimCategory)
            .join(DimCategory, FactEmission.category_key == DimCategory.category_key)
            .filter(FactEmission.company_key == dim.company_key).all())
    if not rows:
        return None
    grouped: dict[str, list[dict]] = defaultdict(list)
    for f, c in rows:
        grouped[c.scope].append({
            "record_no": f.record_no, "category": c.category,
            "basis": f.activity_qty if f.activity_qty is not None else f.amount_cny,
            "unit": ("kWh" if c.category == "electricity" else "L" if c.category == "diesel_combustion" else "CNY"),
            "factor_id": f.factor_id, "emissions_kgco2e": round(f.emissions_kgco2e, 6),
        })
    return {"scopes": {k: {"scope": k, "total_kgco2e": round(sum(i["emissions_kgco2e"] for i in v), 6),
                           "items": v} for k, v in grouped.items()}}


__all__ = ["refresh_olap", "star_summary", "star_ring", "star_trend", "star_drilldown"]
