from pathlib import Path
from models.core import calculate_company
from models.factors import load_factors

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
    return calculate_company(records, factors)

if __name__ == "__main__":
    import json
    print(json.dumps(run_demo(), ensure_ascii=False, indent=2))
