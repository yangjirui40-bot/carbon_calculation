"""碳排全景驾驶舱数据服务：环形分布、桑基图、时序趋势、下钻分析。"""
from __future__ import annotations

from collections import defaultdict

import numpy as np

from ..models import BusinessRecord, CalculationRun
from . import load_factors_from_db


def _latest_run(db, company_id: int, operation: str = "enterprise") -> CalculationRun | None:
    return (
        db.query(CalculationRun)
        .filter(CalculationRun.company_id == company_id, CalculationRun.operation == operation,
                CalculationRun.status == "success")
        .order_by(CalculationRun.id.desc())
        .first()
    )


def _factor_value(db, factor_id: str) -> float:
    from ..models import EmissionFactor

    f = db.query(EmissionFactor).filter(EmissionFactor.factor_id == factor_id).first()
    return float(f.value) if f else 0.0


def get_summary(db, company_id: int) -> dict:
    """星型模型优先（OLAP 聚合），未构建时回退 OLTP 核算结果。"""
    from . import olap as olap_svc

    star = olap_svc.star_summary(db, company_id)
    if star:
        return star
    run = _latest_run(db, company_id)
    if not run or not run.result:
        return {"total_kgco2e": 0.0, "scope_breakdown": {"scope1": 0.0, "scope2": 0.0, "scope3": 0.0}}
    return {
        "run_id": run.run_id,
        "total_kgco2e": run.result.get("total_kgco2e", 0.0),
        "scope_breakdown": run.result.get("scope_breakdown", {"scope1": 0.0, "scope2": 0.0, "scope3": 0.0}),
        "period": run.result.get("period"),
    }


def get_ring(db, company_id: int) -> dict:
    """环形图：三大范围占比 + 子类别拆分（星型模型优先）。"""
    from . import olap as olap_svc

    star_cats = olap_svc.star_ring(db, company_id)
    if star_cats is not None:
        run = _latest_run(db, company_id)
        s = get_summary(db, company_id)
        breakdown = s.get("scope_breakdown", {})
        total = s.get("total_kgco2e", 0.0) or 1.0
        scope_names = {"scope1": "范围1 直接排放", "scope2": "范围2 间接排放(能源)", "scope3": "范围3 价值链排放"}
        scopes = [
            {"scope": k, "name": scope_names.get(k, k), "emissions_kgco2e": round(breakdown.get(k, 0.0), 6),
             "ratio": round(breakdown.get(k, 0.0) / total, 6)}
            for k in ("scope1", "scope2", "scope3")
        ]
        return {"scopes": scopes, "categories": star_cats}
    run = _latest_run(db, company_id)
    if not run or not run.result:
        return {"scopes": [], "categories": []}
    breakdown = run.result.get("scope_breakdown", {})
    total = run.result.get("total_kgco2e", 0.0) or 1.0
    scope_names = {"scope1": "范围1 直接排放", "scope2": "范围2 间接排放(能源)", "scope3": "范围3 价值链排放"}
    scopes = [
        {
            "scope": k,
            "name": scope_names.get(k, k),
            "emissions_kgco2e": round(breakdown.get(k, 0.0), 6),
            "ratio": round(breakdown.get(k, 0.0) / total, 6),
        }
        for k in ("scope1", "scope2", "scope3")
    ]
    # 子类别：来自 items 的 category 汇总
    cat_map = defaultdict(float)
    for item in run.result.get("items", []):
        cat_map[item.get("category")] += item.get("emissions_kgco2e", 0.0)
    categories = [
        {"category": k, "emissions_kgco2e": round(v, 6), "scope": item_scope(k)}
        for k, v in sorted(cat_map.items(), key=lambda x: -x[1])
    ]
    return {"scopes": scopes, "categories": categories}


def item_scope(category: str) -> str:
    m = {
        "diesel_combustion": "scope1",
        "electricity": "scope2",
        "electronic_components": "scope3",
        "pcb_materials": "scope3",
        "packaging_materials": "scope3",
    }
    return m.get(category, "scope3")


def get_sankey(db, company_id: int) -> dict:
    """桑基图：能源/采购输入 -> 生产环节 -> 三大范围碳排放。"""
    s = get_summary(db, company_id)
    b = s["scope_breakdown"]
    s1, s2, s3 = b.get("scope1", 0.0), b.get("scope2", 0.0), b.get("scope3", 0.0)

    nodes = [
        {"name": "电网"}, {"name": "柴油"}, {"name": "外购商品与服务"},
        {"name": "生产车间"}, {"name": "公用工程"}, {"name": "办公区"}, {"name": "供应链上游"},
        {"name": "范围1 直接排放"}, {"name": "范围2 间接排放"}, {"name": "范围3 价值链排放"},
    ]
    links = [
        {"source": "电网", "target": "生产车间", "value": round(s2 * 0.6, 4)},
        {"source": "电网", "target": "公用工程", "value": round(s2 * 0.3, 4)},
        {"source": "电网", "target": "办公区", "value": round(s2 * 0.1, 4)},
        {"source": "柴油", "target": "生产车间", "value": round(s1, 4)},
        {"source": "外购商品与服务", "target": "供应链上游", "value": round(s3, 4)},
        {"source": "生产车间", "target": "范围2 间接排放", "value": round(s2 * 0.6, 4)},
        {"source": "公用工程", "target": "范围2 间接排放", "value": round(s2 * 0.3, 4)},
        {"source": "办公区", "target": "范围2 间接排放", "value": round(s2 * 0.1, 4)},
        {"source": "生产车间", "target": "范围1 直接排放", "value": round(s1, 4)},
        {"source": "供应链上游", "target": "范围3 价值链排放", "value": round(s3, 4)},
    ]
    return {"nodes": nodes, "links": links, "summary": s}


def _period_series(db, company_id: int) -> list[dict]:
    records = (
        db.query(BusinessRecord)
        .filter(BusinessRecord.company_id == company_id, BusinessRecord.review_status == "confirmed")
        .all()
    )
    period_map: dict[str, dict] = defaultdict(lambda: {"scope1": 0.0, "scope2": 0.0, "scope3": 0.0, "total": 0.0})
    for r in records:
        ef = _factor_value(db, r.factor_id)
        if r.scope == "scope1" and r.quantity:
            e = r.quantity * ef
        elif r.scope == "scope2" and r.quantity:
            e = r.quantity * ef
        elif r.scope == "scope3" and r.amount:
            e = r.amount * ef
        else:
            e = 0.0
        d = period_map[r.period]
        d[r.scope] += e
        d["total"] += e
    series = [
        {"period": p, **{k: round(v, 6) for k, v in d.items()}}
        for p, d in sorted(period_map.items())
    ]
    return series


def get_trend(db, company_id: int, forecast_months: int = 6) -> dict:
    """时序趋势：历史曲线 + 线性外推预测 + 减排红线（星型模型优先）。"""
    from . import olap as olap_svc

    star = olap_svc.star_trend(db, company_id)
    if star is not None:
        series = star
    else:
        series = _period_series(db, company_id)
    historical = series
    totals = [s["total"] for s in series]

    forecast = []
    red_line = []
    target = totals[-1] if totals else 0.0
    if len(totals) >= 2:
        x = np.arange(len(totals))
        slope, intercept = np.polyfit(x, totals, 1)
        for i in range(1, forecast_months + 1):
            xi = len(totals) - 1 + i
            forecast.append(
                {"period": f"预测+{i}月", "total": round(max(0.0, slope * xi + intercept), 4)}
            )
        # 年度减排 5% 红线
        target = totals[-1] * (0.95 ** (forecast_months / 12))
    red_line = [round(target, 4)] * (len(historical) + len(forecast))

    return {
        "historical": historical,
        "forecast": forecast,
        "target_line": red_line,
        "target_total_kgco2e": round(target, 4),
        "exceed_warning": any(f["total"] > target for f in forecast) if forecast else False,
    }


def get_drilldown(db, company_id: int) -> dict:
    """多维度下钻：按范围/类别汇总，并附明细记录（星型模型优先）。"""
    from . import olap as olap_svc

    star = olap_svc.star_drilldown(db, company_id)
    if star is not None:
        return star
    records = (
        db.query(BusinessRecord)
        .filter(BusinessRecord.company_id == company_id, BusinessRecord.review_status == "confirmed")
        .all()
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        ef = _factor_value(db, r.factor_id)
        basis = r.quantity if r.scope in ("scope1", "scope2") else r.amount
        unit = r.unit if r.scope in ("scope1", "scope2") else r.currency
        emissions = (basis or 0.0) * ef
        grouped[r.scope].append(
            {
                "record_no": r.record_no,
                "period": r.period,
                "category": r.category,
                "basis": basis,
                "unit": unit,
                "factor_id": r.factor_id,
                "emissions_kgco2e": round(emissions, 6),
            }
        )
    scopes = {
        k: {
            "scope": k,
            "total_kgco2e": round(sum(i["emissions_kgco2e"] for i in v), 6),
            "items": v,
        }
        for k, v in grouped.items()
    }
    return {"scopes": scopes}


__all__ = ["get_summary", "get_ring", "get_sankey", "get_trend", "get_drilldown"]
