"""合规报告生成：ISO 14064 企业盘查清单 / ISO 14067 产品碳足迹报告（结构化数据）。"""
from __future__ import annotations

from datetime import datetime, timezone

from ..models import Company, CalculationRun, Product, Report


def _report_no(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"


def generate_iso14064(db, company_id: int, run_id: str | None = None, language: str = "zh") -> dict:
    company = db.query(Company).filter(Company.id == company_id).first()
    run = (
        db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
        if run_id
        else db.query(CalculationRun).filter(
            CalculationRun.company_id == company_id, CalculationRun.operation == "enterprise",
            CalculationRun.status == "success").order_by(CalculationRun.id.desc()).first()
    )
    if not run or not isinstance(run.result, dict):
        return {"company_id": company_id, "found": False}

    r = run.result
    content = {
        "standard": "ISO 14064-1:2018",
        "company": {"code": company.code, "name": company.name, "industry": company.industry},
        "reporting_period": r.get("period"),
        "total_kgco2e": r.get("total_kgco2e"),
        "scope_breakdown": r.get("scope_breakdown"),
        "items": r.get("items"),
        "factor_versions": r.get("factor_versions"),
        "boundary": "组织边界：运营控制法；核算边界覆盖范围1、范围2、范围3（采购商品与服务）。",
        "data_quality_note": "排放因子为演示设定，正式生产需替换为受控的官方/实测因子。",
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
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"report_no": report.report_no, "title": report.title, "content": content}


def generate_pcf(db, product_id: str, run_id: str | None = None, language: str = "zh") -> dict:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    run = (
        db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
        if run_id
        else db.query(CalculationRun).filter(
            CalculationRun.product_id == product_id, CalculationRun.operation == "product",
            CalculationRun.status == "success").order_by(CalculationRun.id.desc()).first()
    )
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
        "data_quality_note": "含一手/二手数据标识，满足 ISO 14067 数据质量要求；因子为演示设定。",
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
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"report_no": report.report_no, "title": report.title, "content": content}


__all__ = ["generate_iso14064", "generate_pcf"]
