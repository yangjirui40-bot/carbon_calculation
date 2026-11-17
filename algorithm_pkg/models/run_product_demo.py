import json
from pathlib import Path
from models.factors import load_factors
from models.product_carbon import calculate_product_carbon

BASE = Path(__file__).resolve().parents[1]

def run_demo():
    factors = load_factors(BASE / "data" / "demo_factors.csv")
    product = {
        "product_id": "p001",
        "product_name": "控制板模块",
        "output_quantity": 1000,
        "product_unit": "件",
    }
    bom = [
        {"bom_item_id":"b001","material_name":"电子元器件","material_amount":7000,
         "matched_category":"electronic_components","matched_factor_id":"DEMO_EEIO_01"},
        {"bom_item_id":"b002","material_name":"PCB基板","material_amount":2000,
         "matched_category":"pcb_materials","matched_factor_id":"DEMO_EEIO_02"},
        {"bom_item_id":"b003","material_name":"包装纸盒","material_amount":1000,
         "matched_category":"packaging_materials","matched_factor_id":"DEMO_EEIO_03"},
    ]
    return calculate_product_carbon(product, bom, factors)

if __name__ == "__main__":
    print(json.dumps(run_demo(), ensure_ascii=False, indent=2))
