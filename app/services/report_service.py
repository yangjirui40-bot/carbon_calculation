"""合规报告生成：ISO 14064 企业盘查清单 / ISO 14067 产品碳足迹报告（结构化数据）。"""
from __future__ import annotations

from datetime import datetime, timezone
import uuid
from fastapi import HTTPException

from ..models import Company, CalculationRun, Product, Report
from ..models.inventory import InventoryEvent, InventoryPeriod
from .inventory import lock_company
from .report_archive import archive_report


def _report_no(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"


def generate_iso14064(db, company_id: int, run_id: str | None = None, language: str = "zh",
                      *, require_closed_period: bool = False) -> dict:
    if require_closed_period and not run_id:
        raise HTTPException(status_code=422, detail="请选择关账的核算快照")
    lock_company(db, company_id)
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="企业不存在")
    run = (
        db.query(CalculationRun).filter(CalculationRun.run_id == run_id, CalculationRun.company_id == company_id, CalculationRun.operation == "enterprise", CalculationRun.status == "success").first()
        if run_id
        else db.query(CalculationRun).filter(
            CalculationRun.company_id == company_id, CalculationRun.operation == "enterprise",
            CalculationRun.status == "success").order_by(CalculationRun.id.desc()).first()
    )
    if run_id and run is None:
        raise HTTPException(status_code=404, detail="对应企业或产品下不存在该核算结果")
    if not run or not isinstance(run.result, dict):
        return {"company_id": company_id, "found": False}

    closed = db.query(InventoryPeriod).filter_by(company_id=company_id, run_id=run.run_id, status="closed").first()
    if require_closed_period and closed is None:
        raise HTTPException(status_code=409, detail="该月度快照当前未关账，不能生成已关账报告")
    approval = None
    if closed:
        event = db.query(InventoryEvent).filter_by(period_id=closed.id, revision=closed.revision, action="close").one()
        approval = {"period": closed.period, "revision": closed.revision, "boundary": closed.boundary,
                    "approved_at": event.created_at.isoformat(), "run_id": run.run_id}
    r = run.result
    periods = sorted({item["period"] for item in r.get("items", []) if item.get("period")})
    content = {
        "standard": "ISO 14064-1:2018",
        "company": {"code": company.code, "name": company.name, "industry": company.industry},
        "reporting_period": "、".join(periods) or r.get("period"),
        "internal_approval": approval,
        "boundary_snapshot": r.get("boundary_snapshot"),
        "electricity_certificates": r.get("electricity_certificates", []),
        "scope_assessments": r.get("scope_assessments", []),
        "total_kgco2e": r.get("total_kgco2e"),
        "scope_breakdown": r.get("scope_breakdown"),
        "items": r.get("items"),
        "factor_versions": r.get("factor_versions"),
        "boundary": "汇总所选快照内已确认的范围 1、2 和 3 活动。已登记的组织边界和覆盖评估随报告固定。",
        "data_quality_note": ("含演示因子，仅用于流程验证。" if r.get("is_demo") else "") + "请核对因子来源、气体覆盖、组织边界与价格年度。核算由企业自行复核。",
        "assurance_status": "not_independently_verified",
        "warnings": run.warnings or [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "language": language,
    }
    report = Report(
        report_no=_report_no("ISO14064"),
        company_id=company_id,
        report_type="ISO14064",
        run_id=run.run_id,
        title=f"{company.name} 温室气体盘查清单",
        language=language,
        content=content,
    )
    archive_report(db, report)
    db.refresh(report)
    return {"report_no": report.report_no, "title": report.title, "content": content}


def generate_pcf(db, product_id: str, run_id: str | None = None, language: str = "zh") -> dict:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")
    run = (
        db.query(CalculationRun).filter(CalculationRun.run_id == run_id, CalculationRun.product_id == product_id, CalculationRun.company_id == product.company_id, CalculationRun.operation == "product", CalculationRun.status == "success").first()
        if run_id
        else db.query(CalculationRun).filter(
            CalculationRun.product_id == product_id, CalculationRun.company_id == product.company_id,
            CalculationRun.operation == "product", CalculationRun.status == "success").order_by(CalculationRun.id.desc()).first()
    )
    if run_id and run is None:
        raise HTTPException(status_code=404, detail="对应企业或产品下不存在该核算结果")
    if not run or not isinstance(run.result, dict):
        return {"product_id": product_id, "found": False}

    r = run.result
    content = {
        "standard": "ISO 14067:2018",
        "product": {
            "product_id": r.get("product_id"), "product_name": r.get("product_name"),
            "output_quantity": r.get("output_quantity"), "product_unit": r.get("product_unit"),
        },
        "total_upstream_emissions_kgco2e": r.get("total_upstream_emissions_kgco2e"),
        "unit_product_emissions_kgco2e": r.get("unit_product_emissions_kgco2e"),
        "unit_label": r.get("unit_label"),
        "items": r.get("items"),
        "boundary": r.get("boundary"),
        "study": r.get("study"),
        "production_allocations": r.get("production_allocations", []),
        "production_emissions_kgco2e": r.get("production_emissions_kgco2e"),
        "total_study_emissions_kgco2e": r.get("total_study_emissions_kgco2e"),
        "unit_study_emissions_kgco2e": r.get("unit_study_emissions_kgco2e"),
        "data_quality_note": ("含演示因子，仅用于流程验证。" if r.get("is_demo") else "") + "采购上游采用金额法；若已分摊生产活动，单列其已关账来源。需核对研究边界、因子与价格年度。",
        "assurance_status": "not_independently_verified",
        "warnings": run.warnings or [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "language": language,
    }
    report = Report(
        report_no=_report_no("PCF"),
        company_id=product.company_id,
        report_type="PCF",
        run_id=run.run_id,
        title=f"{r.get('product_name')} 产品碳足迹核查报告",
        language=language,
        content=content,
    )
    archive_report(db, report)
    db.refresh(report)
    return {"report_no": report.report_no, "title": report.title, "content": content}


__all__ = ["generate_iso14064", "generate_pcf"]
