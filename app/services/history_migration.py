"""Migrate facts that can be reconstructed from older calculation snapshots."""
from sqlalchemy import select, text

from ..database import SessionLocal
from ..models import CalculationRun
from ..models.operational_history import ScenarioCashflow, ScenarioMeasure, ScenarioProjection
from .scenario_history import persist_scenario_history


def migrate():
    with SessionLocal.begin() as db:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(42160212)"))
        already_present = [
            select(model.calculation_run_id).where(model.calculation_run_id == CalculationRun.id)
            for model in (ScenarioMeasure, ScenarioProjection, ScenarioCashflow)
        ]
        runs = db.scalars(
            select(CalculationRun).where(
                CalculationRun.operation == "scenario", CalculationRun.status == "success",
                *(~query.exists() for query in already_present),
            ).execution_options(yield_per=50)
        )
        for run in runs:
            persist_scenario_history(db, run)


if __name__ == "__main__":
    migrate()
