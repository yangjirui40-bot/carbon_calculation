"""Dashboard views derived from the same immutable calculation result."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
import re

from fastapi import HTTPException

from ..models import CalculationRun, EmissionBudget

SCOPES = {
    "scope1": "范围1 直接排放",
    "scope2": "范围2 能源间接排放",
    "scope3": "范围3 价值链排放",
}
CATEGORIES = {
    "diesel_combustion": "柴油燃烧",
    "electricity": "外购电力",
    "electronic_components": "电子元器件采购",
    "pcb_materials": "PCB 材料采购",
    "packaging_materials": "包装材料采购",
}


def _runs(db, company_id):
    return db.query(CalculationRun).filter(
        CalculationRun.company_id == company_id,
        CalculationRun.operation == "enterprise",
        CalculationRun.status == "success",
    ).order_by(CalculationRun.id.desc())


def _select_run(db, company_id, run_id=None):
    query = _runs(db, company_id)
    run = query.filter(CalculationRun.run_id == run_id).first() if run_id else query.first()
    if run_id and not run:
        raise HTTPException(status_code=404, detail="未找到该企业的成功核算")
    return run


def _summary(run):
    result = (run.result or {}) if run else {}
    items = result.get("items", [])
    periods = sorted({item["period"] for item in items if item.get("period")})
    return {
        "run_id": run.run_id if run else None,
        "period": periods[0] if len(periods) == 1 else None,
        "periods": periods,
        "record_count": len(items),
        "excluded_count": len(result.get("excluded_record_ids", [])),
        "uses_demo_factors": bool(result.get("is_demo", False)),
        "total_kgco2e": result.get("total_kgco2e", 0.0),
        "scope_breakdown": {key: result.get("scope_breakdown", {}).get(key, 0.0) for key in SCOPES},
    }


def _views(run):
    summary = _summary(run)
    total = summary["total_kgco2e"]
    items = (run.result or {}).get("items", []) if run else []
    categories = defaultdict(float)
    grouped = defaultdict(list)
    counts = defaultdict(int)
    locations = defaultdict(float)
    value_chain = defaultdict(float)
    allocation_links = defaultdict(float)
    sites = defaultdict(float)
    actual_sites = {item.get("site_id"): item.get("site_name") for item in items if item.get("site_id")}
    assessments = {row["category"]: row for row in (run.result or {}).get("scope_assessments", [])} if run else {}
    for item in items:
        scope = item["scope"]
        category = item["category"]
        emissions = item["emissions_kgco2e"]
        categories[scope, category] += emissions
        counts[scope, category] += 1
        workshop = item.get("workshop")
        line = item.get("production_line")
        site_id = item.get("site_id")
        site_name = actual_sites.get(site_id)
        locations[site_id, workshop, line, scope] += emissions
        if site_id:
            sites[site_id, scope] += emissions
        if scope == "scope3":
            value_chain[item.get("scope3_category")] += emissions
        if emissions > 0:
            activity_node = ("activity", category)
            organization_node = ("organization", f"{site_name} [{item.get('site_code', site_id)}]", workshop, line) if site_id else ("organization", workshop, line)
            scope_node = ("scope", scope)
            allocation_links[activity_node, organization_node] += emissions
            allocation_links[organization_node, scope_node] += emissions
        grouped[scope].append({
            "record_no": item["record_id"], "period": item.get("period"),
            "category": category, "factor_id": item["factor_id"],
            "site_id": site_id, "site_name": site_name, "workshop": workshop, "production_line": line, "scope3_category": item.get("scope3_category"),
            "basis": item.get("activity_or_amount"), "unit": item.get("basis_unit"),
            "emissions_kgco2e": emissions,
        })
    ring = {
        "scopes": [
            {"scope": key, "name": label, "emissions_kgco2e": summary["scope_breakdown"][key],
             "ratio": round(summary["scope_breakdown"][key] / total, 6) if total else 0.0}
            for key, label in SCOPES.items()
        ],
        "categories": [
            {"scope": scope, "category": category, "emissions_kgco2e": round(value, 6)}
            for (scope, category), value in sorted(categories.items(), key=lambda item: -item[1])
        ],
    }
    links = [
        {"source": CATEGORIES.get(c["category"], c["category"]), "target": SCOPES[c["scope"]],
         "value": c["emissions_kgco2e"], "scope": c["scope"], "category": c["category"],
         "record_count": counts[c["scope"], c["category"]]}
        for c in ring["categories"] if c["emissions_kgco2e"] > 0
    ]
    nodes = [{"name": name} for name in dict.fromkeys(link[key] for key in ("source", "target") for link in links)]
    drilldown = {"scopes": {
        scope: {"scope": scope, "total_kgco2e": summary["scope_breakdown"][scope], "items": rows}
        for scope, rows in grouped.items()
    }}
    return {"summary": summary, "ring": ring, "sankey": {"nodes": nodes, "links": links, "summary": summary},
            "drilldown": drilldown, "production": {
                "locations": [{"site_id": site, "site_name": actual_sites.get(site), "workshop": workshop,
                               "production_line": line, "scope": scope, "emissions_kgco2e": round(value, 6)}
                              for (site, workshop, line, scope), value in sorted(locations.items(), key=lambda row: -row[1])],
                "sites": [{"site_id": site, "site_name": actual_sites[site], "scope": scope,
                           "emissions_kgco2e": round(value,6)} for (site, scope),value in sites.items()],
                "scope3": [{"category": code, "emissions_kgco2e": round(value_chain.get(code, 0), 6),
                            "has_records": code in value_chain, "assessment": assessments.get(code)} for code in [*range(1, 16), None]],
                "sankey": _production_flow(allocation_links),
            }}


def _production_flow(grouped):
    import json
    edges = sorted(grouped.items(), key=lambda row: -row[1])
    nodes = {}
    links = []
    for (source, target), value in edges:
        keys = []
        for node in (source, target):
            kind, code, *line = node
            key = json.dumps(node, ensure_ascii=False)
            keys.append(key)
            if kind == "activity":
                label, depth = CATEGORIES.get(code, code), 0
            elif kind == "organization":
                label, depth = " / ".join(filter(None, (code, *line))) or "未归集车间", 1
            else:
                label, depth = SCOPES[code], 2
            nodes[key] = {"name": key, "label": label, "depth": depth}
        links.append({"source": keys[0], "target": keys[1], "value": round(value, 6)})
    return {"nodes": list(nodes.values()), "links": links}


def _month_index(period):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period or "") or period[:4] == "0000":
        return None
    month = date.fromisoformat(period + "-01")
    return month.year * 12 + month.month - 1


def _trend(db, company_id, forecast_months, selected_run):
    history = {}
    if selected_run:
        for row in _runs(db, company_id).filter(CalculationRun.id <= selected_run.id).limit(240):
            summary = _summary(row)
            period = summary["period"]
            if _month_index(period) is not None and period not in history:
                history[period] = {"period": period, "total": summary["total_kgco2e"], **summary["scope_breakdown"],
                                   "run_id": row.run_id}
    historical = sorted(history.values(), key=lambda point: point["period"])[-24:]
    forecast = []
    recent = historical[-6:]
    months = [_month_index(point["period"]) for point in recent]
    if len(months) >= 3 and months[-1] - months[0] == len(months) - 1:
        x_mean = (len(recent) - 1) / 2
        y_mean = sum(point["total"] for point in recent) / len(recent)
        slope = sum((i - x_mean) * (p["total"] - y_mean) for i, p in enumerate(recent)) / sum(
            (i - x_mean) ** 2 for i in range(len(recent))
        )
        for offset in range(1, min(max(forecast_months, 0), 36) + 1):
            year, month = divmod(months[-1] + offset, 12)
            forecast.append({"period": f"{year:04d}-{month + 1:02d}",
                             "total": round(max(0.0, y_mean + slope * (x_mean + offset)), 6)})
    return {"historical": historical, "forecast": forecast, "target_line": [],
            "target_total_kgco2e": None, "exceed_warning": False}


def get_summary(db, company_id, run_id=None):
    return _summary(_select_run(db, company_id, run_id))


def get_ring(db, company_id, run_id=None):
    return _views(_select_run(db, company_id, run_id))["ring"]


def get_sankey(db, company_id, run_id=None):
    return _views(_select_run(db, company_id, run_id))["sankey"]


def get_drilldown(db, company_id, run_id=None):
    return _views(_select_run(db, company_id, run_id))["drilldown"]


def get_trend(db, company_id, forecast_months=6, run_id=None):
    return _trend(db, company_id, forecast_months, _select_run(db, company_id, run_id))


def get_budget(db, company_id, year, history):
    budget = db.get(EmissionBudget, (company_id, year))
    months = [point for point in history if point["period"].startswith(f"{year}-")]
    elapsed = int(months[-1]["period"][-2:]) if months else 0
    actual = round(sum(point["total"] for point in months), 6)
    limit = budget.annual_limit_kgco2e if budget else None
    prorated = round(limit * elapsed / 12, 6) if limit is not None and elapsed else None
    return {
        "year": year, "annual_limit_kgco2e": limit, "allocated_kgco2e": prorated,
        "actual_kgco2e": actual, "covered_months": len(months), "elapsed_months": elapsed,
        "status": ("unset" if budget is None else "over" if (prorated is not None and actual > prorated)
                   else "incomplete" if not elapsed or elapsed != len(months) else "within"),
    }


def get_snapshot(db, company_id, run_id=None):
    run = _select_run(db, company_id, run_id)
    trend = _trend(db, company_id, 6, run)
    year = int(trend["historical"][-1]["period"][:4]) if trend["historical"] else date.today().year
    budget = get_budget(db, company_id, year, trend["historical"])
    trend["budget_year"] = year
    annual = budget["annual_limit_kgco2e"]
    trend["monthly_budget_kgco2e"] = annual / 12 if annual is not None else None
    if annual is not None:
        trend["exceed_warning"] = any(point["period"].startswith(f"{year}-") and point["total"] > annual / 12
                                      for point in trend["forecast"])
    return {**_views(run), "trend": trend, "budget": budget}
