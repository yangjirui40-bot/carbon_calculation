"""核算编排服务：将业务数据转换为算法输入，调用统一引擎并持久化任务。"""
from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from ..schemas import RecordClassification

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
from .energy import period_allocations
from .inventory import ledger_digest, lock_company
from .run_evidence import persist_lines
from .scenario_history import persist_scenario_history
from .organization import active_boundary, boundary_snapshot, fix_boundary_inputs, scope_snapshot


def _persist_run(
    db,
    request: dict,
    result: dict,
    company_id: int | None = None,
    product_id: str | None = None,
    factors: dict | None = None,
    *, commit: bool = True,
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
        request_snapshot=store_secret({**request, "factor_snapshot": factors if factors is not None else load_factors_from_db(db, company_id=company_id)}),  # AES-256-GCM 加密存储财务输入快照
        factor_versions=factor_versions,
        algorithm_version=result.get("model_version", settings.ALGORITHM_VERSION),
        status=result.get("status", "error"),
        result=data,
        warnings=result.get("warnings") or [],
        error_message=(result.get("warnings") or [None])[0] if result.get("status") == "error" else None,
    )
    db.add(run)
    db.flush()
    persist_lines(db, run, request, result)
    if commit:
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


def _add_pricing_warnings(result: dict, factors: dict) -> None:
    if not result.get("success"):
        return
    items = (result.get("data") or {}).get("items", [])
    used = {item.get("factor_id") for item in items}
    notes = sorted({
        f"因子 {key} 采用 {factors[key]['price_basis']}。请核对未税采购金额已换算至对应价格年度；平台不自动平减。"
        for key in used if key in factors and factors[key].get("price_basis")
    })
    if notes:
        result["warnings"] = list(dict.fromkeys([*(result.get("warnings") or []), *notes]))


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
    if factor_set == "official-2024-footprint":
        raise HTTPException(status_code=400, detail="生命周期电力碳足迹因子不能替代企业Scope2用电排放因子")
    provenance = {}
    if records is None:
        provenance["source"] = "ledger"
        if company_id is None:
            raise HTTPException(status_code=400, detail="缺少 company_id 或 records")
        lock_company(db, company_id)
        algo_records = records_to_algo(_load_confirmed_records(db, company_id, period))
        if period and re.fullmatch(r"[1-9][0-9]{3}-(0[1-9]|1[0-2])", period):
            provenance.update(inventory_period=period, ledger_digest=ledger_digest(algo_records))
            provenance["electricity_certificates"] = period_allocations(db,company_id,period)
            boundary = active_boundary(db, company_id, period)
            if boundary:
                scope = boundary_snapshot(db, boundary)
                provenance.update(boundary_snapshot=scope, scope_assessments=scope_snapshot(db, company_id, period))
                algo_records = fix_boundary_inputs(algo_records, scope)
    else:
        # Inline data cannot invent links to a tenant's evidence vault.
        try:
            algo_records = [
                {**record, "company_id": company_id, "document_id": None,
                 **RecordClassification.model_validate({
                     **record, "scope3_category": record.get("scope3_category") if record.get("scope") == "scope3" else None,
                 }).model_dump()}
                for record in records
            ]
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail="内联记录的组织或范围 3 归集无效") from exc

    extra_warnings: list[str] = []
    if factor_set:
        try:
            algo_records, extra_warnings = apply_factor_set(algo_records, factor_set, db=db)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if company_id is not None:
        enforce_quota(db, company_id, "calculation")
    factors = load_factors_from_db(db, company_id=company_id)
    request = {"operation": "enterprise", "payload": {"records": algo_records}, **provenance}
    result = _engine_call(request, factors)
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    if provenance.get("electricity_certificates") and result.get("success"):
        result["data"]["electricity_certificates"] = provenance["electricity_certificates"]
    if provenance.get("boundary_snapshot") and result.get("success"):
        result["data"].update(boundary_snapshot=provenance["boundary_snapshot"],
                              scope_assessments=provenance["scope_assessments"])
    _add_pricing_warnings(result, factors)
    _persist_run(db, request, result, company_id=company_id, factors=factors)
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
    factors = load_factors_from_db(db, company_id=company_id)
    result = engine_calculate(request, factors)
    _add_pricing_warnings(result, factors)
    _persist_run(db, request, result, company_id=company_id, factors=factors)
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
            **({"assembly_path": b.assembly.assembly_path} if b.assembly else {}),
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
    frozen_factors: dict | None = None,
    study_snapshot: dict | None = None,
) -> dict:
    if company_id is not None:
        enforce_quota(db, company_id, "calculation")
    if product is None or bom_items is None:
        if not product_id:
            raise HTTPException(status_code=400, detail="缺少 product_id 或 product/bom_items")
        product, bom_items = _load_product_payload(db, product_id)
    extra_warnings: list[str] = []
    if factor_set:
        bom_items, extra_warnings = _apply_bom_factor_set(db, bom_items, factor_set)
    factors = frozen_factors if frozen_factors is not None else load_factors_from_db(db, company_id=company_id)
    request = {"operation": "product", "payload": {"product": product, "bom_items": bom_items}}
    result = _engine_call(request, factors)
    if study_snapshot and result.get("success"):
        request["product_study"] = study_snapshot
        data = result["data"]
        data["study"] = study_snapshot["study"]
        data["production_allocations"] = study_snapshot["allocations"]
        production = sum(item["emissions_kgco2e"] for item in study_snapshot["allocations"])
        data["production_emissions_kgco2e"] = round(production,6)
        data["total_study_emissions_kgco2e"] = round(data["total_upstream_emissions_kgco2e"]+production,6)
        if production or study_snapshot["allocations"]:
            data["unit_study_emissions_kgco2e"] = round(data["total_study_emissions_kgco2e"]/data["output_quantity"],6)
            data["boundary"] = "上游采购及所列已关账生产活动，按企业声明的分摊依据。其他阶段覆盖以研究边界说明为准。"
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    _add_pricing_warnings(result, factors)
    _persist_run(db, request, result, company_id=company_id, product_id=product_id or product.get("product_id"), factors=factors)
    return result


def _apply_bom_factor_set(db, bom_items: list[dict], factor_set: str) -> tuple[list[dict], list[str]]:
    """BOM 明细按因子集重映射（matched_category -> 官方因子）。"""
    from .research_catalog import mappings

    mapping = mappings(db).get(factor_set)
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


def _load_baseline(db, company_id: int, baseline_run_id: str | None) -> tuple[list[dict], dict]:
    if baseline_run_id:
        run = db.query(CalculationRun).filter(
            CalculationRun.run_id == baseline_run_id, CalculationRun.company_id == company_id,
            CalculationRun.operation == "enterprise", CalculationRun.status == "success",
        ).first()
        snapshot = read_secret(run.request_snapshot) if run and run.request_snapshot else None
        records = (snapshot or {}).get("payload", {}).get("records")
        if records is not None:
            return records, (snapshot or {}).get("factor_snapshot") or {}
        raise HTTPException(status_code=404, detail="未找到该企业的基线核算快照")
    return records_to_algo(_load_confirmed_records(db, company_id)), {}


def run_scenario_calc(
    db,
    company_id: int,
    scenario_id: str | None,
    scenario_name: str,
    electricity_saving_rate: float,
    procurement_reduction_rate: float,
    baseline_run_id: str | None = None,
    factor_set: str | None = None,
    electricity_substitution_rate: float = 0.0,
    finance: dict | None = None,
    forecast_months: int = 6,
    *,
    persist: bool = True,
) -> dict:
    from .dashboard_service import get_trend
    from .roi_service import compute_roi

    sid = (scenario_id or f"sc-{uuid4().hex}") if persist else "preview"
    if persist:
        existing = db.query(Scenario).filter_by(scenario_id=sid).first()
        if existing and existing.company_id != company_id:
            raise HTTPException(status_code=409, detail="情景编号已存在")
    if not persist and not baseline_run_id:
        raise HTTPException(status_code=422, detail="请选择成功的企业核算作为预演基线")
    baseline_records, frozen_factors = _load_baseline(db, company_id, baseline_run_id)
    extra_warnings: list[str] = []
    if factor_set:
        try:
            baseline_records, extra_warnings = apply_factor_set(baseline_records, factor_set, db=db)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    factors = load_factors_from_db(db, company_id=company_id)
    if frozen_factors:
        factors.update(frozen_factors)
        if factor_set:
            current = load_factors_from_db(db, company_id=company_id)
            used_ids = {record["factor_id"] for record in baseline_records}
            for factor_id in used_ids & current.keys():
                factors[factor_id] = current[factor_id]

    # Substitute the remaining grid demand after efficiency improvements.
    net_grid_savings = round(1 - (1 - electricity_saving_rate) * (1 - electricity_substitution_rate), 12)
    request = {
        "operation": "scenario",
        "payload": {
            "baseline_records": baseline_records,
            "scenario_id": sid,
            "scenario_name": scenario_name,
            "electricity_saving_rate": net_grid_savings,
            "procurement_reduction_rate": procurement_reduction_rate,
            "baseline_run_id": baseline_run_id,
        },
    }
    result = _engine_call(request, factors)
    if extra_warnings and result.get("success"):
        result["warnings"] = list(result.get("warnings") or []) + extra_warnings
    _add_pricing_warnings(result, factors)
    if result.get("success"):
        data = result["data"]
        assumptions = {
            "electricity_saving_rate": electricity_saving_rate,
            "electricity_substitution_rate": electricity_substitution_rate,
            "procurement_reduction_rate": procurement_reduction_rate,
        }
        data["assumptions"] = assumptions
        request["payload"]["assumptions"] = assumptions

        if baseline_run_id is not None:
            trend = get_trend(db, company_id, max(forecast_months, 12 if finance else 0), baseline_run_id)
            history, future = trend["historical"], trend["forecast"]
            ratio = data["reduction_rate"]
            shown = future[:forecast_months]
            data["projection"] = {
                "method": "recent_monthly_linear_projection",
                "history_months": len(history),
                "historical": [{"period": point["period"], "kgco2e": point["total"]} for point in history],
                "forecast": [{"period": point["period"], "baseline_kgco2e": point["total"],
                              "scenario_kgco2e": round(point["total"] * (1 - ratio), 6)} for point in shown],
            }
            if finance is not None:
                annual_abatement = sum(point["total"] for point in future[:12]) * ratio if len(future) >= 12 else 0.0
                data["finance"] = finance
                data["roi"] = compute_roi(**finance, annual_reduction_kgco2e=annual_abatement)
                data["roi"]["carbon_price"] = finance["carbon_price"]
                data["roi"]["carbon_income_included"] = bool(len(future) >= 12 and finance["carbon_price"] > 0)
                request["payload"]["finance"] = finance

    if not persist:
        return result

    enforce_quota(db, company_id, "calculation")
    run = _persist_run(db, request, result, company_id=company_id, factors=factors, commit=False)
    persist_scenario_history(db, run)

    if result.get("success") and isinstance(result.get("data"), dict):
        data = result["data"]
        scenario = db.query(Scenario).filter_by(scenario_id=sid).with_for_update().first()
        if scenario and scenario.company_id != company_id:
            raise HTTPException(status_code=409, detail="情景编号已存在")
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
            roi=data.get("roi"),
        )
        if scenario is None:
            scenario = Scenario(scenario_id=sid, **fields)
            db.add(scenario)
        else:
            for k, v in fields.items():
                setattr(scenario, k, v)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", "") == "ix_scenarios_scenario_id":
            raise HTTPException(status_code=409, detail="情景编号已存在") from exc
        raise
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
