"""第一阶段基础碳核算引擎：Scope 1 / Scope 2 / Scope 3（金额法演示口径）。"""
from __future__ import annotations
from typing import Any

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

class CalculationError(ValueError):
    """输入数据或因子不满足核算规则时抛出。"""

def _number(value: Any, field: str) -> float:
    if value is None or value == "":
        raise CalculationError(f"缺少必填数值字段：{field}")
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise CalculationError(f"{field} 必须是数值")
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
    if factor["category"] != category:
        raise CalculationError(f"记录 {rid} 的因子类别与业务类别不匹配")
    if factor["unit"] != EXPECTED_FACTOR_UNITS[category]:
        raise CalculationError(
            f"因子 {factor_id} 量纲错误：要求 {EXPECTED_FACTOR_UNITS[category]}，"
            f"实际 {factor['unit']}"
        )

    if expected_scope in ("scope1", "scope2"):
        activity_unit = "L" if expected_scope == "scope1" else "kWh"
        if record.get("unit") != activity_unit:
            raise CalculationError(
                f"记录 {rid} 活动单位错误：{expected_scope} 要求 {activity_unit}"
            )
        activity = _number(record.get("quantity"), "quantity")
        emissions = activity * float(factor["value"])
        basis = activity
        basis_unit = activity_unit
    else:
        if record.get("currency") != "CNY":
            raise CalculationError(f"记录 {rid} 首版仅支持 CNY 未税采购金额")
        if record.get("unit") not in (None, ""):
            raise CalculationError(f"记录 {rid} Scope 3 金额法不应填写活动量单位")
        amount = _number(record.get("amount"), "amount")
        emissions = amount * float(factor["value"])
        basis = amount
        basis_unit = "CNY"

    return {
        "record_id": rid,
        "company_id": record.get("company_id"),
        "period": record.get("period"),
        "scope": expected_scope,
        "category": category,
        "factor_id": factor_id,
        "factor_version": factor["version"],
        "activity_or_amount": basis,
        "basis_unit": basis_unit,
        "emissions_kgco2e": round(emissions, 6),
        "is_demo": bool(factor.get("is_demo", True)),
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
        "is_demo": True,
    }
