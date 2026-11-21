"""Save a scenario's exact projections and modelled flows using the calculation run key."""
from sqlalchemy import select

from ..models.operational_history import ScenarioCashflow, ScenarioMeasure, ScenarioProjection

MEASURES = ("electricity_saving_rate", "electricity_substitution_rate", "procurement_reduction_rate")


def persist_scenario_history(db, run):
    if run.status != "success" or not isinstance(run.result, dict):
        return
    data = run.result
    assumptions = data.get("assumptions") or {}
    rows = [
        ScenarioMeasure(calculation_run_id=run.id, measure_code=code, amount_or_ratio=value)
        for code in MEASURES if (value := assumptions.get(code)) is not None
    ]
    projections = (data.get("projection") or {}).get("forecast") or []
    rows.extend(
        ScenarioProjection(calculation_run_id=run.id, period=point["period"], scope=0,
                           bau_kgco2e=point["baseline_kgco2e"], intervention_kgco2e=point["scenario_kgco2e"])
        for point in projections
    )
    roi = data.get("roi") or {}
    if roi.get("capex") is not None:
        rows.append(ScenarioCashflow(calculation_run_id=run.id, project_year=0,
                                     flow_type="initial_investment", amount=-roi["capex"]))
    for flow in roi.get("cash_flows") or []:
        for field in ("cash_flow", "discounted", "cumulative", "discounted_cumulative"):
            rows.append(ScenarioCashflow(calculation_run_id=run.id, project_year=flow["year"],
                                         flow_type=field, amount=flow[field]))
    db.add_all(rows)


def render_history(db, run):
    def rows(model, *order):
        return db.scalars(select(model).where(model.calculation_run_id == run.id).order_by(*order))

    return {
        "run_id": run.run_id,
        "measures": [{"code": r.measure_code, "ratio": float(r.amount_or_ratio)}
                     for r in rows(ScenarioMeasure, ScenarioMeasure.measure_code)],
        "projections": [{"period": r.period, "scope": r.scope, "baseline_kgco2e": float(r.bau_kgco2e),
                         "scenario_kgco2e": float(r.intervention_kgco2e)}
                        for r in rows(ScenarioProjection, ScenarioProjection.period, ScenarioProjection.scope)],
        "cashflows": [{"year": r.project_year, "type": r.flow_type, "amount": float(r.amount), "currency": r.currency}
                      for r in rows(ScenarioCashflow, ScenarioCashflow.project_year, ScenarioCashflow.flow_type)],
    }
