"""核算编排服务：将业务数据转换为算法输入，调用统一引擎并持久化任务。"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from ..config import settings
from ..crypto import read_secret, store_secret
from ..models import (
    BOMItem,
    BusinessRecord,
    CalculationRun,
    Product,
    Scenario,
)
from . import (
    apply_factor_set,
    engine_calculate,
    load_factors_from_db,
    records_to_algo,
    run_scenario,
    compare_scenarios,
)
from .billing_service import enforce_quota


def _persist_run(
    db,
    request: dict,
    result: dict,
    company_id: int | None = None,
    product_id: str | None = None,
) -> CalculationRun:
    data = result.get("data") or {}
    factor_versions = None
    if isinstance(data, dict):
        factor_versions = data.get("factor_versions")
    run = CalculationRun(
        run_id=result["run_id"],
        operation=result.get("operation", request.get("operation")),
        company_id=company_id,
        product_id=product_id,
        request_snapshot=store_secret(request),  # AES-256-GCM 加密存储财务输入快照
        factor_versions=factor_versions,
        algorithm_version=result.get("model_version", settings.ALGORITHM_VERSION),
        status=result.get("status", "error"),
        result=data,
        warnings=result.get("warnings") or [],
        error_message=(result.get("warnings") or [None])[0] if result.get("status") == "error" else None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _engine_call(request: dict, factors: dict) -> dict:
    """调用统一计算引擎并记录耗时指标。"""
    import time

    from ..metrics import CALC_DURATION

    t0 = time.perf_counter()
    result = engine_calculate(request, factors)
    CALC_DURATION.labels(request.get("operation", "unknown")).observe(time.perf_counter() - t0)
    return result


def _load_confirmed_records(db, company_id: int, period: str | None = None) -> list[BusinessRecord]:
    q = db.query(BusinessRecord).filter(
        BusinessRecord.company_id == company_id,
        BusinessRecord.review_status == "confirmed",
    )
    if period:
        q = q.filter(BusinessRecord.period == period)
    return q.all()


def run_enterprise(
    db,
    company_id: int | None = None,
    period: str | None = None,
    records: list[dict] | None = None,
    factor_set: str | None = None,
) -> dict:
    """企业 Scope 1/2/3 核算。未提供 records 时从数据库读取已确认记录。

    factor_set：可选官方因子集（official-2022 / official-2022-hunan 等），
    将对应类别记录自动切换到官方因子。
    """
    if company_id is not None:
        enforce_quota(db, company_id, "calculation")
    if records is None:
        if company_id is None:
            raise HTTPException(status_code=400, detail="缺少 company_id 或 records")
        algo_records = records_to_algo(_load_confirmed_records(db, company_id, period))
    else:
        algo_records = records

    extra_warnings: list[str] = []
    if factor_set:
        try:
            algo_records, extra_warnings = apply_factor_set(algo_records, factor_set)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    factors = load_factors_from_db(db)
    request = {"operation": "enterprise", "payload": {"records": algo_records}}
    result = _engine_call(request, factors)
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    _persist_run(db, request, result, company_id=company_id)
    return result


def run_eiolca(
    db,
    purchase_vector_cny: list[float],
    A: list[list[float]] | None = None,
    g: list[float] | None = None,
    sectors: list[str] | None = None,
    company_id: int | None = None,
) -> dict:
    if company_id is not None:
        enforce_quota(db, company_id, "calculation")
    payload: dict[str, Any] = {"purchase_vector_cny": purchase_vector_cny}
    if A is not None:
        payload["A"] = A
    if g is not None:
        payload["g"] = g
    if sectors is not None:
        payload["sectors"] = sectors
    request = {"operation": "eiolca", "payload": payload}
    result = engine_calculate(request, load_factors_from_db(db))
    _persist_run(db, request, result, company_id=company_id)
    return result


def _load_product_payload(db, product_id: str) -> tuple[dict, list[dict]]:
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"产品不存在：{product_id}")
    bom = db.query(BOMItem).filter(BOMItem.product_id == p.id).all()
    if not bom:
        raise HTTPException(status_code=400, detail="该产品 BOM 为空，请先导入 BOM")
    product = {
        "product_id": p.product_id,
        "product_name": p.product_name,
        "output_quantity": p.output_quantity,
        "product_unit": p.product_unit,
    }
    bom_items = [
        {
            "bom_item_id": b.bom_item_id,
            "material_name": b.material_name,
            "material_amount": b.material_amount,
            "currency": b.currency,
            "matched_category": b.matched_category,
            "matched_factor_id": b.matched_factor_id,
        }
        for b in bom
    ]
    return product, bom_items


def run_product(
    db,
    product_id: str | None = None,
    product: dict | None = None,
    bom_items: list[dict] | None = None,
    company_id: int | None = None,
    factor_set: str | None = None,
) -> dict:
    if company_id is not None:
        enforce_quota(db, company_id, "calculation")
    if product is None or bom_items is None:
        if not product_id:
            raise HTTPException(status_code=400, detail="缺少 product_id 或 product/bom_items")
        product, bom_items = _load_product_payload(db, product_id)
    extra_warnings: list[str] = []
    if factor_set:
        bom_items, extra_warnings = _apply_bom_factor_set(bom_items, factor_set)
    factors = load_factors_from_db(db)
    request = {"operation": "product", "payload": {"product": product, "bom_items": bom_items}}
    result = _engine_call(request, factors)
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    _persist_run(db, request, result, company_id=company_id, product_id=product_id or product.get("product_id"))
    return result


def _apply_bom_factor_set(bom_items: list[dict], factor_set: str) -> tuple[list[dict], list[str]]:
    """BOM 明细按因子集重映射（matched_category -> 官方因子）。"""
    from .factor_library import FACTOR_SETS

    mapping = FACTOR_SETS.get(factor_set)
    if not mapping:
        raise HTTPException(status_code=400, detail=f"未知因子集：{factor_set}")
    out = []
    warnings = []
    for it in bom_items:
        it = dict(it)
        category = it.get("matched_category")
        if category in mapping:
            it["matched_factor_id"] = mapping[category]
        else:
            warnings.append(f"BOM 物料类别 {category} 在因子集 {factor_set} 中无官方因子，沿用原因子")
        out.append(it)
    return out, warnings


def _load_baseline_records(db, company_id: int, baseline_run_id: str | None) -> list[dict]:
    if baseline_run_id:
        run = db.query(CalculationRun).filter(CalculationRun.run_id == baseline_run_id).first()
        if run and run.request_snapshot:
            snapshot = read_secret(run.request_snapshot)
            records = (snapshot or {}).get("payload", {}).get("records")
            if records:
                return records
        raise HTTPException(status_code=404, detail=f"基准核算不存在：{baseline_run_id}")
    return records_to_algo(_load_confirmed_records(db, company_id))


def run_scenario_calc(
    db,
    company_id: int,
    scenario_id: str | None,
    scenario_name: str,
    electricity_saving_rate: float,
    procurement_reduction_rate: float,
    baseline_run_id: str | None = None,
    factor_set: str | None = None,
) -> dict:
    enforce_quota(db, company_id, "calculation")
    baseline_records = _load_baseline_records(db, company_id, baseline_run_id)
    extra_warnings: list[str] = []
    if factor_set:
        try:
            baseline_records, extra_warnings = apply_factor_set(baseline_records, factor_set)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    factors = load_factors_from_db(db)

    sid = scenario_id or f"sc-{abs(hash((company_id, electricity_saving_rate, procurement_reduction_rate, scenario_name))) % 10**8:08d}"
    request = {
        "operation": "scenario",
        "payload": {
            "baseline_records": baseline_records,
            "scenario_id": sid,
            "scenario_name": scenario_name,
            "electricity_saving_rate": electricity_saving_rate,
            "procurement_reduction_rate": procurement_reduction_rate,
            "baseline_run_id": baseline_run_id,
        },
    }
    result = _engine_call(request, factors)
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    _persist_run(db, request, result, company_id=company_id)

    if result.get("success") and isinstance(result.get("data"), dict):
        data = result["data"]
        scenario = db.query(Scenario).filter(Scenario.scenario_id == sid).first()
        fields = dict(
            scenario_name=scenario_name,
            company_id=company_id,
            baseline_run_id=baseline_run_id or result["run_id"],
            electricity_saving_rate=electricity_saving_rate,
            procurement_reduction_rate=procurement_reduction_rate,
            baseline_total_kgco2e=data.get("baseline_total_kgco2e"),
            scenario_total_kgco2e=data.get("scenario_total_kgco2e"),
            reduction_kgco2e=data.get("reduction_kgco2e"),
            reduction_rate=data.get("reduction_rate"),
            result=data,
        )
        if scenario is None:
            scenario = Scenario(scenario_id=sid, **fields)
            db.add(scenario)
        else:
            for k, v in fields.items():
                setattr(scenario, k, v)
        db.commit()
    return result


def compare_scenario_runs(db, results: list[dict]) -> dict:
    data = compare_scenarios(results)
    return {
        "success": True,
        "run_id": None,
        "operation": "scenario_compare",
        "status": "success",
        "data": data,
        "warnings": [],
        "model_version": settings.ALGORITHM_VERSION,
    }


__all__ = [
    "run_enterprise",
    "run_eiolca",
    "run_product",
    "run_scenario_calc",
    "compare_scenario_runs",
]
