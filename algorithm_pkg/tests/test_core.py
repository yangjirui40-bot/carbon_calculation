import unittest
from models.core import calculate_company, calculate_record, CalculationError
from models.factors import load_factors
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACTORS = load_factors(ROOT / "data" / "demo_factors.csv")

class TestPhase1(unittest.TestCase):
    def setUp(self):
        self.records = [
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

    def test_demo_expected_values(self):
        result = calculate_company(self.records, FACTORS)
        self.assertAlmostEqual(result["scope_breakdown"]["scope1"], 107.2)
        self.assertAlmostEqual(result["scope_breakdown"]["scope2"], 696.0)
        self.assertAlmostEqual(result["scope_breakdown"]["scope3"], 3500.0)
        self.assertAlmostEqual(result["total_kgco2e"], 4303.2)

    def test_unconfirmed_record_excluded(self):
        self.records[0]["review_status"] = "pending"
        result = calculate_company(self.records, FACTORS)
        self.assertEqual(result["excluded_record_ids"], ["r001"])
        self.assertAlmostEqual(result["total_kgco2e"], 4196.0)

    def test_negative_quantity_rejected(self):
        self.records[0]["quantity"] = -1
        with self.assertRaises(CalculationError):
            calculate_record(self.records[0], FACTORS)

    def test_scope_mismatch_rejected(self):
        self.records[0]["scope"] = "scope3"
        with self.assertRaises(CalculationError):
            calculate_record(self.records[0], FACTORS)

    def test_wrong_unit_rejected(self):
        self.records[1]["unit"] = "L"
        with self.assertRaises(CalculationError):
            calculate_record(self.records[1], FACTORS)

    def test_unknown_factor_rejected(self):
        self.records[2]["factor_id"] = "UNKNOWN"
        with self.assertRaises(CalculationError):
            calculate_record(self.records[2], FACTORS)

if __name__ == "__main__":
    unittest.main()
