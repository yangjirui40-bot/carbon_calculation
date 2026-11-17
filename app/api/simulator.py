"""减排路径模拟器路由：情景、ROI、轨迹对比。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import Scenario, User
from ..schemas import ROIRequest, ScenarioCalcRequest
from ..services.calculation_service import run_scenario_calc
from ..services.roi_service import compute_roi
from ..services.dashboard_service import get_summary

router = APIRouter(prefix="/simulator", tags=["减排路径模拟器"])


@router.post("/run")
def run_simulation(payload: ScenarioCalcRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    return run_scenario_calc(
        db,
        company_id=payload.company_id,
        scenario_id=payload.scenario_id,
        scenario_name=payload.scenario_name,
        electricity_saving_rate=payload.electricity_saving_rate,
        procurement_reduction_rate=payload.procurement_reduction_rate,
        baseline_run_id=payload.baseline_run_id,
        factor_set=payload.factor_set,
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
            "roi": s.roi,
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
        reduction_rate = s.reduction_rate or 0
        interventions.append({
            "scenario_id": s.scenario_id,
            "scenario_name": s.scenario_name,
            "curve": [round(max(0.0, v * (1 - reduction_rate)), 4) for v in bau],
        })
    return {
        "labels": [h["period"] for h in trend["historical"]] + [f["period"] for f in trend["forecast"]],
        "bau": bau,
        "interventions": interventions,
        "summary": get_summary(db, company_id),
    }
