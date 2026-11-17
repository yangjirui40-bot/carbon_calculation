"""统一计算引擎入口。

面向后端的稳定入口：
    result = calculate(request)

request.operation 支持：
- enterprise: 企业 Scope 1/2/3 核算
- eiolca: EIO-LCA 独立矩阵演示
- product: 产品 BOM 上游排放估算
- scenario: 基于企业基准记录的减排情景

本层负责请求校验、模块路由、统一响应结构和 run_id。
不在本层重复实现数学公式。
"""
from __future__ import annotations
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path
from typing import Any

from models.core import calculate_company
from models.factors import load_factors
from models.eiolca import calculate_eiolca, SECTORS, A_DEMO, G_DEMO
from models.product_carbon import calculate_product_carbon
from models.scenario import run_scenario, compare_scenarios

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_FACTOR_PATH = BASE_DIR / "data" / "demo_factors.csv"

class EngineRequestError(ValueError):
    pass

def _response(operation: str, status: str, data: dict, warnings=None, run_id=None):
    return {
        "success": status == "success",
        "run_id": run_id or f"run-{uuid4().hex[:12]}",
        "operation": operation,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data": data,
        "warnings": warnings or [],
        "model_version": "carbon-engine-v0.4",
    }

def _required(payload: dict, key: str):
    if key not in payload or payload[key] is None:
        raise EngineRequestError(f"请求缺少必填字段：{key}")
    return payload[key]

def calculate(request: dict, factors: dict | None = None) -> dict:
    """统一计算入口；错误以统一 success=false 结构返回。"""
    if not isinstance(request, dict):
        raise EngineRequestError("request 必须是 JSON 对象")
    operation = request.get("operation")
    payload = request.get("payload", {})
    if not isinstance(payload, dict):
        raise EngineRequestError("payload 必须是 JSON 对象")

    if factors is None:
        factors = load_factors(request.get("factor_file", DEFAULT_FACTOR_PATH))

    try:
        if operation == "enterprise":
            records = _required(payload, "records")
            result = calculate_company(records, factors)
            data = {
                "company_id": result["company_id"],
                "period": result["period"],
                "total_kgco2e": result["total_kgco2e"],
                "scope_breakdown": result["scope_breakdown"],
                "items": result["items"],
                "excluded_record_ids": result["excluded_record_ids"],
                "factor_versions": result["factor_versions"],
                "is_demo": result["is_demo"],
            }
            return _response(operation, "success", data, result["warnings"])

        if operation == "eiolca":
            y = _required(payload, "purchase_vector_cny")
            A = payload.get("A", A_DEMO)
            g = payload.get("g", G_DEMO)
            sectors = payload.get("sectors", SECTORS)
            result = calculate_eiolca(y=y, A=A, g=g, sector_names=sectors)
            return _response(operation, "success", result, [
                "当前 EIO-LCA 矩阵和排放强度为合成演示参数，非真实行业数据库。"
            ])

        if operation == "product":
            product = _required(payload, "product")
            bom_items = _required(payload, "bom_items")
            result = calculate_product_carbon(product, bom_items, factors)
            return _response(operation, "success", result, result.get("warnings", []))

        if operation == "scenario":
            records = _required(payload, "baseline_records")
            scenario = run_scenario(
                baseline_records=records,
                factors=factors,
                scenario_id=payload.get("scenario_id", "scenario-001"),
                scenario_name=payload.get("scenario_name", "未命名情景"),
                electricity_saving_rate=payload.get("electricity_saving_rate", 0),
                procurement_reduction_rate=payload.get("procurement_reduction_rate", 0),
                baseline_run_id=payload.get("baseline_run_id"),
            )
            return _response(operation, "success", scenario, scenario.get("warnings", []))

        raise EngineRequestError(
            "operation 不支持；可选 enterprise、eiolca、product、scenario"
        )
    except (EngineRequestError, ValueError, KeyError, TypeError) as exc:
        return _response(operation or "unknown", "error", {}, [str(exc)])

def compare_scenario_results(results: list[dict]) -> dict:
    """对同一基准 run_id 的情景结果进行比较，统一封装响应。"""
    try:
        data = compare_scenarios(results)
        return _response("scenario_compare", "success", data)
    except (ValueError, KeyError, TypeError) as exc:
        return _response("scenario_compare", "error", {}, [str(exc)])
