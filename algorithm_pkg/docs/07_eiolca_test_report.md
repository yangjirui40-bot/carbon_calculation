# 第二阶段 EIO-LCA 测试记录

执行命令：`python -m unittest discover -s tests -v`

退出码：0

```text
Spreadsheet runtime warmup failed during python startup
Traceback (most recent call last):
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/patches/warm_spreadsheet_runtime_on_startup.py", line 26, in warm_spreadsheet_runtime_on_startup
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/spreadsheet_warmup.py", line 785, in warm_spreadsheet_runtime
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/spreadsheet_warmup.py", line 718, in _warm_feature_flows
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/spreadsheet_warmup.py", line 509, in _warm_drawing_and_image_flows
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/generated/interface/models.py", line 32861, in bring_to_front
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/rpc/remote.py", line 764, in __call__
  File "/tmp/tmp.QlpUkOUI9D/artifact_tool_v2-2.8.66/artifact_tool/rpc/client.py", line 175, in call
artifact_tool.rpc.client.RemoteError: Element ordering requires an owning element collection.
test_demo_expected_values (test_core.TestPhase1.test_demo_expected_values) ... ok
test_negative_quantity_rejected (test_core.TestPhase1.test_negative_quantity_rejected) ... ok
test_scope_mismatch_rejected (test_core.TestPhase1.test_scope_mismatch_rejected) ... ok
test_unconfirmed_record_excluded (test_core.TestPhase1.test_unconfirmed_record_excluded) ... ok
test_unknown_factor_rejected (test_core.TestPhase1.test_unknown_factor_rejected) ... ok
test_wrong_unit_rejected (test_core.TestPhase1.test_wrong_unit_rejected) ... ok
test_leontief_inverse_identity (test_eiolca.TestEIOLCA.test_leontief_inverse_identity) ... ok
test_matrix_model_runs_and_is_nonnegative (test_eiolca.TestEIOLCA.test_matrix_model_runs_and_is_nonnegative) ... ok
test_negative_purchase_rejected (test_eiolca.TestEIOLCA.test_negative_purchase_rejected) ... ok
test_total_equals_f_dot_y (test_eiolca.TestEIOLCA.test_total_equals_f_dot_y) ... ok
test_unstable_matrix_rejected (test_eiolca.TestEIOLCA.test_unstable_matrix_rejected) ... ok
test_wrong_vector_length_rejected (test_eiolca.TestEIOLCA.test_wrong_vector_length_rejected) ... ok

----------------------------------------------------------------------
Ran 12 tests in 0.003s

OK

```

EIO-LCA 演示退出码：0

```json
{
  "model": "EIO-LCA",
  "sectors": [
    "electronic_components",
    "pcb_materials",
    "packaging_materials"
  ],
  "A": [
    [
      0.1,
      0.05,
      0.02
    ],
    [
      0.08,
      0.12,
      0.03
    ],
    [
      0.02,
      0.04,
      0.08
    ]
  ],
  "I_minus_A_inverse": [
    [
      1.117448170807565,
      0.06469145768653395,
      0.026401855594290563
    ],
    [
      0.10256637094745338,
      1.143988256012297,
      0.03953366858621519
    ],
    [
      0.02875175897179286,
      0.05114495586328538,
      1.0892493302775372
    ]
  ],
  "g_kgco2e_per_cny": [
    0.2,
    0.3,
    0.08
  ],
  "y_cny": [
    7000.0,
    2000.0,
    1000.0
  ],
  "f_kgco2e_per_cny": [
    0.25655968616349245,
    0.36022636481005865,
    0.10428041811692565
  ],
  "sector_emissions_kgco2e": {
    "electronic_components": 1795.91780314,
    "pcb_materials": 720.45272962,
    "packaging_materials": 104.28041812
  },
  "total_kgco2e": 2620.65095088,
  "diagnostics": {
    "det_I_minus_A": 0.723434,
    "condition_number": 1.1827399050986098,
    "spectral_radius_A": 0.18871907622696632,
    "leading_principal_minors": {
      "indices_1": 0.9,
      "indices_2": 0.88,
      "indices_3": 0.92,
      "indices_1_2": 0.788,
      "indices_1_3": 0.8276,
      "indices_2_3": 0.8084,
      "indices_1_2_3": 0.723434
    }
  },
  "is_demo": true,
  "parameter_status": "synthetic_demo_not_empirical",
  "unit_note": "g/f: kgCO2e/CNY; y: CNY; E: kgCO2e"
}

```
