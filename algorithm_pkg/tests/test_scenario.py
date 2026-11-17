import unittest
from pathlib import Path
from copy import deepcopy
from models.factors import load_factors
from models.scenario import run_scenario, compare_scenarios, ScenarioError

ROOT = Path(__file__).resolve().parents[1]
FACTORS = load_factors(ROOT / "data" / "demo_factors.csv")

class TestScenario(unittest.TestCase):
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

    def test_electricity_10_percent(self):
        r = run_scenario(self.records, FACTORS, "sc001", "节电10%", 0.10, 0)
        self.assertAlmostEqual(r["baseline_total_kgco2e"], 4303.2)
        self.assertAlmostEqual(r["scenario_total_kgco2e"], 4233.6)
        self.assertAlmostEqual(r["reduction_kgco2e"], 69.6)

    def test_electricity_15_purchase_5(self):
        r = run_scenario(self.records, FACTORS, "sc002", "节电15%+采购减少5%", 0.15, 0.05)
        self.assertAlmostEqual(r["scenario_total_kgco2e"], 4023.8)
        self.assertAlmostEqual(r["reduction_kgco2e"], 279.4)

    def test_scope1_unchanged(self):
        r = run_scenario(self.records, FACTORS, "sc002", "scenario", 0.15, 0.05)
        self.assertAlmostEqual(r["scope_breakdown"]["scope1"], 107.2)

    def test_baseline_records_not_mutated(self):
        original = deepcopy(self.records)
        run_scenario(self.records, FACTORS, "sc001", "scenario", 0.10, 0)
        self.assertEqual(self.records, original)

    def test_rate_out_of_range_rejected(self):
        with self.assertRaises(ScenarioError):
            run_scenario(self.records, FACTORS, "bad", "bad", 1.2, 0)

    def test_comparison_requires_same_baseline(self):
        a = run_scenario(self.records, FACTORS, "a", "a", 0.1, 0, "run-001")
        b = run_scenario(self.records, FACTORS, "b", "b", 0.2, 0, "run-002")
        with self.assertRaises(ScenarioError):
            compare_scenarios([a, b])

if __name__ == "__main__":
    unittest.main()
