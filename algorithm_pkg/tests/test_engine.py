import unittest
from pathlib import Path
from models.calculation_engine import calculate, compare_scenario_results
from models.factors import load_factors
from models.run_scenario_demo import run_demo

ROOT = Path(__file__).resolve().parents[1]
FACTORS = load_factors(ROOT / "data" / "demo_factors.csv")

class TestUnifiedEngine(unittest.TestCase):
    def test_enterprise_dispatch(self):
        req = {
            "operation":"enterprise",
            "payload":{"records":[
                {"id":"r001","company_id":"demo-001","period":"2026-10","category":"diesel_combustion","scope":"scope1","quantity":40,"unit":"L","factor_id":"DEMO_DIESEL_01","review_status":"confirmed"},
                {"id":"r002","company_id":"demo-001","period":"2026-10","category":"electricity","scope":"scope2","quantity":1200,"unit":"kWh","factor_id":"DEMO_ELEC_01","review_status":"confirmed"},
                {"id":"r003","company_id":"demo-001","period":"2026-10","category":"electronic_components","scope":"scope3","amount":10000,"currency":"CNY","factor_id":"DEMO_EEIO_01","review_status":"confirmed"}
            ]}
        }
        r = calculate(req, FACTORS)
        self.assertTrue(r["success"])
        self.assertEqual(r["operation"], "enterprise")
        self.assertAlmostEqual(r["data"]["total_kgco2e"], 4303.2)
        self.assertTrue(r["run_id"].startswith("run-"))

    def test_product_dispatch(self):
        req = {
            "operation":"product",
            "payload":{
                "product":{"product_id":"p001","product_name":"控制板模块","output_quantity":1000,"product_unit":"件"},
                "bom_items":[
                    {"bom_item_id":"b001","material_name":"电子元器件","material_amount":7000,"matched_category":"electronic_components","matched_factor_id":"DEMO_EEIO_01"},
                    {"bom_item_id":"b002","material_name":"PCB基板","material_amount":2000,"matched_category":"pcb_materials","matched_factor_id":"DEMO_EEIO_02"},
                    {"bom_item_id":"b003","material_name":"包装纸盒","material_amount":1000,"matched_category":"packaging_materials","matched_factor_id":"DEMO_EEIO_03"}
                ]
            }
        }
        r = calculate(req, FACTORS)
        self.assertTrue(r["success"])
        self.assertAlmostEqual(r["data"]["unit_product_emissions_kgco2e"], 3.47)

    def test_eiolca_dispatch(self):
        r = calculate({"operation":"eiolca","payload":{"purchase_vector_cny":[7000,2000,1000]}}, FACTORS)
        self.assertTrue(r["success"])
        self.assertGreater(r["data"]["total_kgco2e"], 0)

    def test_unknown_operation_returns_error_envelope(self):
        r = calculate({"operation":"bad","payload":{}}, FACTORS)
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "error")
        self.assertTrue(r["warnings"])

    def test_missing_payload_returns_error_envelope(self):
        r = calculate({"operation":"enterprise","payload":{}}, FACTORS)
        self.assertFalse(r["success"])

    def test_scenario_comparison_integration(self):
        demo = run_demo()
        s = demo["scenario_details"]
        r = compare_scenario_results(s)
        self.assertTrue(r["success"])
        self.assertEqual(len(r["data"]["scenarios"]), 2)

if __name__ == "__main__":
    unittest.main()
