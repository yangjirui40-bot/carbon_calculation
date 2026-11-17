import unittest
import numpy as np
from models.eiolca import (
    calculate_eiolca, calculate_demo_bom, validate_system, EIOLCAError,
    A_DEMO, G_DEMO
)

class TestEIOLCA(unittest.TestCase):
    def test_matrix_model_runs_and_is_nonnegative(self):
        result = calculate_demo_bom()
        self.assertGreater(result["total_kgco2e"], 0)
        self.assertTrue(all(v >= 0 for v in result["f_kgco2e_per_cny"]))
        self.assertTrue(result["is_demo"])
        self.assertEqual(result["parameter_status"], "synthetic_demo_not_empirical")

    def test_leontief_inverse_identity(self):
        result = calculate_demo_bom()
        L = np.asarray(result["I_minus_A_inverse"])
        self.assertTrue(np.allclose((np.eye(3)-A_DEMO) @ L, np.eye(3), atol=1e-10))

    def test_total_equals_f_dot_y(self):
        result = calculate_demo_bom()
        f = np.asarray(result["f_kgco2e_per_cny"])
        y = np.asarray(result["y_cny"])
        self.assertAlmostEqual(result["total_kgco2e"], float(f @ y), places=7)

    def test_negative_purchase_rejected(self):
        with self.assertRaises(EIOLCAError):
            calculate_eiolca([100, -1, 20])

    def test_wrong_vector_length_rejected(self):
        with self.assertRaises(EIOLCAError):
            calculate_eiolca([100, 20])

    def test_unstable_matrix_rejected(self):
        A = np.array([[1.1, 0.0], [0.0, 0.1]])
        with self.assertRaises(EIOLCAError):
            validate_system(A)

if __name__ == "__main__":
    unittest.main()
