import unittest
from pathlib import Path
from models.factors import load_factors
from models.product_carbon import calculate_product_carbon, ProductCarbonError

ROOT = Path(__file__).resolve().parents[1]
FACTORS = load_factors(ROOT / "data" / "demo_factors.csv")

class TestProductCarbon(unittest.TestCase):
    def setUp(self):
        self.product = {
            "product_id":"p001", "product_name":"控制板模块",
            "output_quantity":1000, "product_unit":"件"
        }
        self.bom = [
            {"bom_item_id":"b001","material_name":"电子元器件","material_amount":7000,
             "matched_category":"electronic_components","matched_factor_id":"DEMO_EEIO_01"},
            {"bom_item_id":"b002","material_name":"PCB基板","material_amount":2000,
             "matched_category":"pcb_materials","matched_factor_id":"DEMO_EEIO_02"},
            {"bom_item_id":"b003","material_name":"包装纸盒","material_amount":1000,
             "matched_category":"packaging_materials","matched_factor_id":"DEMO_EEIO_03"},
        ]

    def test_expected_total_and_unit_result(self):
        result = calculate_product_carbon(self.product, self.bom, FACTORS)
        self.assertAlmostEqual(result["total_upstream_emissions_kgco2e"], 3470.0)
        self.assertAlmostEqual(result["unit_product_emissions_kgco2e"], 3.47)

    def test_zero_output_rejected(self):
        self.product["output_quantity"] = 0
        with self.assertRaises(ValueError):
            calculate_product_carbon(self.product, self.bom, FACTORS)

    def test_duplicate_bom_id_rejected(self):
        self.bom[1]["bom_item_id"] = "b001"
        with self.assertRaises(ProductCarbonError):
            calculate_product_carbon(self.product, self.bom, FACTORS)

    def test_unmatched_factor_rejected(self):
        self.bom[0]["matched_factor_id"] = "NO_FACTOR"
        with self.assertRaises(ProductCarbonError):
            calculate_product_carbon(self.product, self.bom, FACTORS)

    def test_category_factor_mismatch_rejected(self):
        self.bom[0]["matched_factor_id"] = "DEMO_EEIO_02"
        with self.assertRaises(ProductCarbonError):
            calculate_product_carbon(self.product, self.bom, FACTORS)

    def test_negative_amount_rejected(self):
        self.bom[0]["material_amount"] = -100
        with self.assertRaises(ValueError):
            calculate_product_carbon(self.product, self.bom, FACTORS)

if __name__ == "__main__":
    unittest.main()
