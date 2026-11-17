import json
from pathlib import Path
from models.factors import load_factors
from models.scenario import run_scenario, compare_scenarios

BASE = Path(__file__).resolve().parents[1]

def run_demo():
    factors = load_factors(BASE / "data" / "demo_factors.csv")
    records = [
        {"id":"r001","company_id":"demo-001","period":"2026-10",
         "category":"diesel_combustion","scope":"scope1","quantity":40,"unit":"L",
         "factor_id":"DEMO_DIESEL_01","review_status":"confirmed"},
        {"id":"r002","company_id":"demo-001","period":"2026-10",
         "category":"electricity","scope":"scope2","quantity":1200,"unit":"kWh",
         "factor_id":"DEMO_ELEC_01","review_status":"confirmed"},
        {"id":"r003","company_id":"demo-001","period":"2026-10",
         "category":"electronic_components","scope":"scope3","amount":10000,
         "currency":"CNY","factor_id":"DEMO_EEIO_01","review_status":"confirmed"},
    ]
    s1 = run_scenario(
        records, factors, "sc001", "节电10%",
        electricity_saving_rate=0.10, procurement_reduction_rate=0,
        baseline_run_id="run-001"
    )
    s2 = run_scenario(
        records, factors, "sc002", "节电15%＋采购减少5%",
        electricity_saving_rate=0.15, procurement_reduction_rate=0.05,
        baseline_run_id="run-001"
    )
    return {
        "baseline_run_id": "run-001",
        "comparison": compare_scenarios([s1, s2]),
        "scenario_details": [s1, s2],
    }

if __name__ == "__main__":
    print(json.dumps(run_demo(), ensure_ascii=False, indent=2))
