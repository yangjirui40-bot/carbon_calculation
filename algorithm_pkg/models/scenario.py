"""减排路径情景模拟器。

基于企业既有核算记录创建情景副本，只调整 Scope 2 用电量和 Scope 3 采购金额；
Scope 1 燃料活动量保持不变。原始记录不被修改。
"""
from __future__ import annotations
from copy import deepcopy
from models.core import calculate_company, CalculationError

class ScenarioError(ValueError):
    pass

def _validate_rate(value, field):
    try:
        rate = float(value)
    except (TypeError, ValueError):
        raise ScenarioError(f"{field} 必须是数值")
    if not 0 <= rate <= 1:
        raise ScenarioError(f"{field} 必须介于 0 和 1 之间")
    return rate

def run_scenario(
    baseline_records: list[dict],
    factors: dict[str, dict],
    scenario_id: str,
    scenario_name: str,
    electricity_saving_rate: float = 0.0,
    procurement_reduction_rate: float = 0.0,
    baseline_run_id: str | None = None,
) -> dict:
    """执行单个情景并与基准核算对比。"""
    if not baseline_records:
        raise ScenarioError("基准业务记录不能为空")

    e_rate = _validate_rate(electricity_saving_rate, "electricity_saving_rate")
    p_rate = _validate_rate(procurement_reduction_rate, "procurement_reduction_rate")

    # 先计算基准，确保情景比较基于一份有效且完整的核算结果。
    baseline = calculate_company(baseline_records, factors)
    adjusted = deepcopy(baseline_records)

    changed_records = []
    for record in adjusted:
        if record.get("review_status") != "confirmed":
            continue
        scope = record.get("scope")
        if scope == "scope2" and record.get("category") == "electricity":
            old = float(record["quantity"])
            new = old * (1 - e_rate)
            record["quantity"] = new
            if e_rate:
                changed_records.append({
                    "record_id": record.get("id"),
                    "variable": "quantity",
                    "before": old,
                    "after": round(new, 8),
                    "unit": record.get("unit"),
                })
        elif scope == "scope3" and record.get("category") in {
            "electronic_components", "pcb_materials", "packaging_materials", "scope3_01",
        } and record.get("amount") is not None and not record.get("unit"):
            old = float(record["amount"])
            new = old * (1 - p_rate)
            record["amount"] = new
            if p_rate:
                changed_records.append({
                    "record_id": record.get("id"),
                    "variable": "amount",
                    "before": old,
                    "after": round(new, 8),
                    "unit": record.get("currency", "CNY"),
                })
        # Scope 1 不调整；其他字段、因子和业务分类不变。

    scenario = calculate_company(adjusted, factors)
    baseline_total = baseline["total_kgco2e"]
    scenario_total = scenario["total_kgco2e"]
    reduction = round(baseline_total - scenario_total, 8)
    reduction_rate = (reduction / baseline_total) if baseline_total else 0.0

    return {
        "scenario_id": scenario_id,
        "scenario_name": scenario_name,
        "baseline_run_id": baseline_run_id,
        "baseline_total_kgco2e": baseline_total,
        "scenario_total_kgco2e": scenario_total,
        "scope_breakdown": scenario["scope_breakdown"],
        "baseline_scope_breakdown": baseline["scope_breakdown"],
        "reduction_kgco2e": reduction,
        "reduction_rate": round(reduction_rate, 8),
        "electricity_saving_rate": e_rate,
        "procurement_reduction_rate": p_rate,
        "changed_records": changed_records,
        "items": scenario["items"],
        "factor_versions": scenario["factor_versions"],
        "is_demo": scenario["is_demo"],
        "warnings": [
            "情景基于所选活动记录与因子版本，用于假设比较。",
            "节电比例仅调整 Scope 2 用电量；采购减少比例仅调整已确认且按金额计量的采购项目。",
            "Scope 1 不随上述情景变化；产品 PCF 不自动并入企业总账。"
        ],
    }

def compare_scenarios(results: list[dict]) -> dict:
    """形成基准与多个情景的横向比较结果。"""
    if not results:
        raise ScenarioError("至少需要一个情景结果")
    baseline_values = {round(x["baseline_total_kgco2e"], 8) for x in results}
    baseline_ids = {x.get("baseline_run_id") for x in results}
    if len(baseline_values) != 1 or len(baseline_ids) != 1:
        raise ScenarioError("待比较情景必须引用同一基准核算结果编号及数值")
    baseline = results[0]["baseline_total_kgco2e"]
    return {
        "baseline_total_kgco2e": baseline,
        "scenarios": [
            {
                "scenario_id": x["scenario_id"],
                "scenario_name": x["scenario_name"],
                "scenario_total_kgco2e": x["scenario_total_kgco2e"],
                "reduction_kgco2e": x["reduction_kgco2e"],
                "reduction_rate": x["reduction_rate"],
                "scope_breakdown": x["scope_breakdown"],
            }
            for x in results
        ],
        "is_demo": scenario["is_demo"],
    }
