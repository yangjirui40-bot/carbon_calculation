"""算法桥接层：封装随包交付的算法模块（models 包）。"""
from __future__ import annotations

from typing import Any

# 算法包位于 backend/algorithm_pkg，app/__init__.py 已将其加入 sys.path。
from models.calculation_engine import calculate as engine_calculate  # noqa: E402
from models.core import (  # noqa: E402
    SCOPE_BY_CATEGORY,
    EXPECTED_FACTOR_UNITS,
    CalculationError,
    calculate_company,
)
from models.eiolca import (  # noqa: E402
    A_DEMO,
    G_DEMO,
    SECTORS,
    calculate_eiolca,
)
from models.factors import load_factors  # noqa: E402
from models.product_carbon import calculate_product_carbon  # noqa: E402
from models.scenario import compare_scenarios, run_scenario  # noqa: E402

# 因子量纲 -> 业务记录使用的活动量/金额字段
_CATEGORY_SCOPE = dict(SCOPE_BY_CATEGORY)


def factor_to_dict(factor) -> dict[str, Any]:
    """ORM EmissionFactor -> 算法期望的因子字典。"""
    scope = factor.scope or _CATEGORY_SCOPE.get(factor.category, "scope3")
    return {
        "factor_id": factor.factor_id,
        "category": factor.category,
        "scope": scope,
        "value": float(factor.value),
        "unit": factor.unit,
        "version": factor.version,
        "origin": factor.origin or "",
        "price_basis": factor.price_basis,
        "is_demo": bool(factor.is_demo),
        "uncertainty_pct": factor.uncertainty_pct,
    }


def factor_rows(db, company_id=None, *, include_private=False):
    from sqlalchemy import or_
    from ..models import EmissionFactor
    from ..models.company_factors import CompanyFactorVersion
    query = db.query(EmissionFactor, CompanyFactorVersion).outerjoin(
        CompanyFactorVersion, CompanyFactorVersion.emission_factor_id == EmissionFactor.id
    )
    if not include_private:
        if company_id is None:
            query = query.filter(CompanyFactorVersion.id.is_(None))
        else:
            query = query.filter(or_(CompanyFactorVersion.id.is_(None), CompanyFactorVersion.tenant_id==company_id))
    return query


def load_factors_from_db(db, factor_set: str | None = None, *, company_id=None, include_private=False) -> dict[str, dict[str, Any]]:
    output = {}
    for factor, version in factor_rows(db, company_id, include_private=include_private):
        values = factor_to_dict(factor)
        if version:
            values.update(valid_from=version.valid_from, valid_to=version.valid_to)
        output[factor.factor_id] = values
    return output


def apply_factor_set(records: list[dict], factor_set: str, *, db=None) -> tuple[list[dict], list[str]]:
    """按因子集重映射记录因子（只替换该集合覆盖的类别），返回 (记录, 警告)。"""
    from .factor_library import FACTOR_SETS

    from .research_catalog import mappings
    library = mappings(db) if db is not None else FACTOR_SETS
    mapping = library.get(factor_set)
    if not mapping:
        raise ValueError(f"未知因子集：{factor_set}；可选：{', '.join(FACTOR_SETS)}")
    out = []
    warnings = []
    for r in records:
        r = dict(r)
        category = r.get("category")
        if category in mapping:
            r["factor_id"] = mapping[category]
        else:
            warnings.append(
                f"类别 {category} 在因子集 {factor_set} 中无官方因子，沿用记录因子 {r.get('factor_id')}"
            )
        out.append(r)
    return out, warnings


def records_to_algo(records) -> list[dict[str, Any]]:
    """ORM BusinessRecord 列表 -> 算法 records 列表。"""
    from .activity import activity_fields

    out = []
    for r in records:
        out.append(
            {
                "id": r.record_no,
                "document_id": r.document_id,
                "company_id": r.company_id,
                "period": r.period,
                "category": r.category,
                "scope": r.scope,
                "quantity": r.quantity,
                "unit": r.unit,
                "amount": r.amount,
                "currency": r.currency,
                "factor_id": r.factor_id,
                "review_status": r.review_status,
                **activity_fields(r),
                **({
                    "workshop": r.dimensions.workshop,
                    "production_line": r.dimensions.production_line,
                    "scope3_category": r.dimensions.scope3_category,
                } if r.dimensions else {}),
            }
        )
    return out


__all__ = [
    "engine_calculate",
    "calculate_company",
    "calculate_eiolca",
    "calculate_product_carbon",
    "run_scenario",
    "compare_scenarios",
    "load_factors",
    "load_factors_from_db",
    "records_to_algo",
    "factor_to_dict",
    "SCOPE_BY_CATEGORY",
    "EXPECTED_FACTOR_UNITS",
    "A_DEMO",
    "G_DEMO",
    "SECTORS",
    "CalculationError",
]
