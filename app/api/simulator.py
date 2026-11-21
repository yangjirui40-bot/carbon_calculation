"""减排路径模拟器路由：情景、ROI、轨迹对比。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import CalculationRun, Scenario, User
from ..schemas import ROIRequest, ScenarioCalcRequest
from ..services.calculation_service import run_scenario_calc
from ..services.roi_service import compute_roi
from ..services.dashboard_service import get_summary
from ..services.scenario_history import render_history

router = APIRouter(prefix="/simulator", tags=["减排路径模拟器"])


@router.post("/run")
def run_simulation(payload: ScenarioCalcRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    return _scenario_response(db, payload, persist=True)


@router.post("/preview")
def preview_simulation(payload: ScenarioCalcRequest, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id)
    result = _scenario_response(db, payload, persist=False)
    if result.get("success"):
        data = result["data"]
        for key in ("items", "changed_records"):
            rows = data.pop(key, [])
            data[key+"_count"] = len(rows)
    return result


def _scenario_response(db, payload, *, persist):
    return run_scenario_calc(
        db,
        company_id=payload.company_id,
        scenario_id=payload.scenario_id,
        scenario_name=payload.scenario_name,
        electricity_saving_rate=payload.electricity_saving_rate,
        procurement_reduction_rate=payload.procurement_reduction_rate,
        baseline_run_id=payload.baseline_run_id,
        factor_set=payload.factor_set,
        electricity_substitution_rate=payload.electricity_substitution_rate,
        finance=payload.finance.model_dump() if payload.finance else None,
        forecast_months=payload.forecast_months,
        persist=persist,
    )


@router.get("/company/{company_id}/scenarios")
def list_scenarios(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    scenarios = db.query(Scenario).filter(Scenario.company_id == company_id).order_by(Scenario.id.desc()).all()
    return [
        {
            "scenario_id": s.scenario_id, "scenario_name": s.scenario_name,
            "baseline_run_id": s.baseline_run_id,
            "electricity_saving_rate": s.electricity_saving_rate,
            "procurement_reduction_rate": s.procurement_reduction_rate,
            "baseline_total_kgco2e": s.baseline_total_kgco2e,
            "scenario_total_kgco2e": s.scenario_total_kgco2e,
            "reduction_kgco2e": s.reduction_kgco2e, "reduction_rate": s.reduction_rate,
            "roi": s.roi, "assumptions": (s.result or {}).get("assumptions"),
        }
        for s in scenarios
    ]


@router.post("/roi")
def roi(payload: ROIRequest, _: User = Depends(get_current_user)):
    return compute_roi(
        capex=payload.capex,
        annual_opex=payload.annual_opex,
        annual_saving=payload.annual_saving,
        annual_reduction_kgco2e=payload.annual_reduction_kgco2e,
        carbon_price=payload.carbon_price,
        project_life=payload.project_life,
        discount_rate=payload.discount_rate,
    )


@router.get("/company/{company_id}/trajectory")
def trajectory(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """BAU 基准线与干预后预测线对比。"""
    check_company_access(db, user, company_id)
    from ..services.dashboard_service import get_trend
    trend = get_trend(db, company_id)
    scenarios = db.query(Scenario).filter(Scenario.company_id == company_id).order_by(Scenario.id).all()
    bau = [h["total"] for h in trend["historical"]] + [f["total"] for f in trend["forecast"]]
    interventions = []
    for s in scenarios:
        baseline = (s.result or {}).get("baseline_scope_breakdown") or {}
        current = (s.result or {}).get("scope_breakdown") or {}
        scope_ratios = {scope: (current[scope] / amount if amount else 1.0)
                        for scope, amount in baseline.items() if scope in current}
        if not scope_ratios:
            continue
        # Historical points are observed; the forward curve alone receives the intervention.
        latest = trend["historical"][-1] if trend["historical"] else None
        if latest is None or not trend["forecast"] or not latest["total"]:
            continue
        projection_ratio = sum(latest.get(scope, 0.0) * scope_ratios.get(scope, 1.0)
                               for scope in ("scope1", "scope2", "scope3")) / latest["total"]
        interventions.append({
            "scenario_id": s.scenario_id,
            "scenario_name": s.scenario_name,
            "curve": [h["total"] for h in trend["historical"]] + [
                round(max(0.0, point["total"] * projection_ratio), 4) for point in trend["forecast"]
            ],
        })
    return {
        "labels": [h["period"] for h in trend["historical"]] + [f["period"] for f in trend["forecast"]],
        "bau": bau,
        "interventions": interventions,
        "summary": get_summary(db, company_id),
        "historical_count": len(trend["historical"]),
        "forecast_count": len(trend["forecast"]),
    }


@router.get("/company/{company_id}/scenarios/{scenario_id}/details")
def scenario_details(company_id: int, scenario_id: str, run_id: str | None = None,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id)
    runs = db.query(CalculationRun).filter(
        CalculationRun.company_id == company_id, CalculationRun.operation == "scenario",
        CalculationRun.status == "success", CalculationRun.result["scenario_id"].as_string() == scenario_id,
    )
    if run_id:
        runs = runs.filter(CalculationRun.run_id == run_id)
    run = runs.order_by(CalculationRun.id.desc()).first()
    if not run:
        raise HTTPException(404, "未找到该情景的核算版本")
    return render_history(db, run)
