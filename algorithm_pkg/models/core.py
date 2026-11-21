"""第一阶段基础碳核算引擎：Scope 1 / Scope 2 / Scope 3（金额法演示口径）。"""
from __future__ import annotations
from typing import Any
import math

SCOPE_BY_CATEGORY = {
    "diesel_combustion": "scope1",
    "electricity": "scope2",
    "electronic_components": "scope3",
    "pcb_materials": "scope3",
    "packaging_materials": "scope3",
}

EXPECTED_FACTOR_UNITS = {
    "diesel_combustion": "kgCO2e/L",
    "electricity": "kgCO2e/kWh",
    "electronic_components": "kgCO2e/CNY",
    "pcb_materials": "kgCO2e/CNY",
    "packaging_materials": "kgCO2e/CNY",
}

CUSTOM_UNITS = {
    "natural_gas": {"m3", "kWh"},
    "refrigerants": {"kg"},
    "purchased_heat": {"kWh", "GJ"},
    **{f"scope3_{i:02d}": {"kg", "t", "tkm", "pkm", "km", "L", "m3", "kWh", "GJ", "piece", "CNY"}
       for i in range(1, 16)},
}
SCOPE_BY_CATEGORY.update(natural_gas="scope1", refrigerants="scope1", purchased_heat="scope2")
SCOPE_BY_CATEGORY.update({f"scope3_{i:02d}": "scope3" for i in range(1,16)})


class CalculationError(ValueError):
    """输入数据或因子不满足核算规则时抛出。"""

def _number(value: Any, field: str) -> float:
    if value is None or value == "":
        raise CalculationError(f"缺少必填数值字段：{field}")
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise CalculationError(f"{field} 必须是数值")
    if not math.isfinite(n):
        raise CalculationError(f"{field} 必须为有限数值")
    if n < 0:
        raise CalculationError(f"{field} 不能小于 0")
    return n

def validate_factor(factor: dict) -> None:
    required = ("factor_id", "category", "value", "unit", "version")
    missing = [k for k in required if factor.get(k) in (None, "")]
    if missing:
        raise CalculationError(f"排放因子缺少字段：{', '.join(missing)}")
    value = _number(factor["value"], "factor.value")
    if value < 0:
        raise CalculationError("排放因子不能小于 0")

def calculate_record(record: dict, factors: dict[str, dict]) -> dict:
    """计算单条已确认业务记录，返回统一结果结构。"""
    rid = record.get("id", "unknown")
    if record.get("review_status") != "confirmed":
        raise CalculationError(f"记录 {rid} 尚未确认，不参与核算")
    category = record.get("category")
    if category not in SCOPE_BY_CATEGORY:
        raise CalculationError(f"记录 {rid} 的业务类别暂不支持：{category}")
    expected_scope = SCOPE_BY_CATEGORY[category]
    if record.get("scope") != expected_scope:
        raise CalculationError(
            f"记录 {rid} 的 Scope 与业务类别不匹配：应为 {expected_scope}"
        )

    factor_id = record.get("factor_id")
    if not factor_id or factor_id not in factors:
        raise CalculationError(f"记录 {rid} 找不到排放因子：{factor_id}")
    factor = factors[factor_id]
    validate_factor(factor)
    if expected_scope == "scope2" and factor.get("version") == "official-2024-footprint":
        raise CalculationError("生命周期电力碳足迹因子不能替代企业Scope2用电排放因子")
    if factor["category"] != category:
        raise CalculationError(f"记录 {rid} 的因子类别与业务类别不匹配")
    period = record.get("period")
    if factor.get("valid_from") and (not period or period < factor["valid_from"] or
                                     (factor.get("valid_to") and period > factor["valid_to"])):
        raise CalculationError(f"记录 {rid} 的月份不在因子有效期内")
    classification = record.get("scope3_category")
    if category in CUSTOM_UNITS:
        numerator, _, denominator = factor["unit"].partition("/")
        if numerator not in {"kgCO2e", "kgCO2"} or denominator not in CUSTOM_UNITS[category]:
            raise CalculationError(f"因子 {factor_id} 的活动量单位不适用")
        if category.startswith("scope3_"):
            declared = int(category[-2:])
            if classification not in (None,declared):
                raise CalculationError(f"类别 {category} 对应范围3第{declared}类")
            classification = declared
        basis_unit = denominator
    else:
        expected = EXPECTED_FACTOR_UNITS[category]
        if factor["unit"] not in {expected, expected.replace("CO2e","CO2")}:
            raise CalculationError(f"因子 {factor_id} 量纲错误：要求 {expected}，实际 {factor['unit']}")
        basis_unit = expected.split("/",1)[1]
    if basis_unit == "CNY":
        if record.get("currency") != "CNY" or record.get("unit") not in (None,""):
            raise CalculationError(f"记录 {rid} 金额法需要 CNY 未税金额，无活动量单位")
        basis = _number(record.get("amount"),"amount")
    else:
        if record.get("unit") != basis_unit:
            raise CalculationError(f"记录 {rid} 活动单位错误：要求 {basis_unit}")
        basis = _number(record.get("quantity"),"quantity")
    emissions = basis * float(factor["value"])

    return {
        "record_id": rid,
        "company_id": record.get("company_id"),
        "period": record.get("period"),
        "scope": expected_scope,
        "category": category,
        **({"scope3_category": classification} if classification is not None else {}),
        "factor_id": factor_id,
        "factor_version": factor["version"],
        "activity_or_amount": basis,
        "basis_unit": basis_unit,
        "emissions_kgco2e": round(emissions, 6),
        "is_demo": bool(factor.get("is_demo", True)),
        **{field: record[field] for field in ("workshop", "production_line", "site_id", "site_name", "site_code", "consolidation_share", "original_quantity", "original_amount")
           if record.get(field) is not None},
    }

def calculate_company(records: list[dict], factors: dict[str, dict]) -> dict:
    """汇总企业核算。未确认记录排除并给出 warning；已确认记录若错误则中止。"""
    results, excluded, warnings = [], [], []
    for record in records:
        if record.get("review_status") != "confirmed":
            excluded.append(record.get("id", "unknown"))
            warnings.append(f"记录 {record.get('id', 'unknown')} 未确认，已排除")
            continue
        results.append(calculate_record(record, factors))

    breakdown = {s: 0.0 for s in ("scope1", "scope2", "scope3")}
    for item in results:
        breakdown[item["scope"]] += item["emissions_kgco2e"]
    breakdown = {k: round(v, 6) for k, v in breakdown.items()}
    total = round(sum(breakdown.values()), 6)

    versions = sorted({x["factor_version"] for x in results})
    return {
        "company_id": records[0].get("company_id") if records else None,
        "period": records[0].get("period") if records else None,
        "total_kgco2e": total,
        "scope_breakdown": breakdown,
        "items": results,
        "excluded_record_ids": excluded,
        "warnings": warnings,
        "factor_versions": versions,
        "is_demo": any(factors[i.get("factor_id", "")].get("is_demo", True) for i in records if i.get("review_status") == "confirmed" and i.get("factor_id") in factors),
    }
