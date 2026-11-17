# 第四阶段情景模拟与全项目回归测试记录

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
test_category_factor_mismatch_rejected (test_product_carbon.TestProductCarbon.test_category_factor_mismatch_rejected) ... ok
test_duplicate_bom_id_rejected (test_product_carbon.TestProductCarbon.test_duplicate_bom_id_rejected) ... ok
test_expected_total_and_unit_result (test_product_carbon.TestProductCarbon.test_expected_total_and_unit_result) ... ok
test_negative_amount_rejected (test_product_carbon.TestProductCarbon.test_negative_amount_rejected) ... ok
test_unmatched_factor_rejected (test_product_carbon.TestProductCarbon.test_unmatched_factor_rejected) ... ok
test_zero_output_rejected (test_product_carbon.TestProductCarbon.test_zero_output_rejected) ... ok
test_baseline_records_not_mutated (test_scenario.TestScenario.test_baseline_records_not_mutated) ... ok
test_comparison_requires_same_baseline (test_scenario.TestScenario.test_comparison_requires_same_baseline) ... ok
test_electricity_10_percent (test_scenario.TestScenario.test_electricity_10_percent) ... ok
test_electricity_15_purchase_5 (test_scenario.TestScenario.test_electricity_15_purchase_5) ... ok
test_rate_out_of_range_rejected (test_scenario.TestScenario.test_rate_out_of_range_rejected) ... ok
test_scope1_unchanged (test_scenario.TestScenario.test_scope1_unchanged) ... ok

----------------------------------------------------------------------
Ran 24 tests in 0.003s

OK

```

情景演示退出码：0

```json
{
  "baseline_run_id": "run-001",
  "comparison": {
    "baseline_total_kgco2e": 4303.2,
    "scenarios": [
      {
        "scenario_id": "sc001",
        "scenario_name": "节电10%",
        "scenario_total_kgco2e": 4233.6,
        "reduction_kgco2e": 69.6,
        "reduction_rate": 0.01617401,
        "scope_breakdown": {
          "scope1": 107.2,
          "scope2": 626.4,
          "scope3": 3500.0
        }
      },
      {
        "scenario_id": "sc002",
        "scenario_name": "节电15%＋采购减少5%",
        "scenario_total_kgco2e": 4023.8,
        "reduction_kgco2e": 279.4,
        "reduction_rate": 0.06492843,
        "scope_breakdown": {
          "scope1": 107.2,
          "scope2": 591.6,
          "scope3": 3325.0
        }
      }
    ],
    "is_demo": true
  },
  "scenario_details": [
    {
      "scenario_id": "sc001",
      "scenario_name": "节电10%",
      "baseline_run_id": "run-001",
      "baseline_total_kgco2e": 4303.2,
      "scenario_total_kgco2e": 4233.6,
      "scope_breakdown": {
        "scope1": 107.2,
        "scope2": 626.4,
        "scope3": 3500.0
      },
      "baseline_scope_breakdown": {
        "scope1": 107.2,
        "scope2": 696.0,
        "scope3": 3500.0
      },
      "reduction_kgco2e": 69.6,
      "reduction_rate": 0.01617401,
      "electricity_saving_rate": 0.1,
      "procurement_reduction_rate": 0.0,
      "changed_records": [
        {
          "record_id": "r002",
          "variable": "quantity",
          "before": 1200.0,
          "after": 1080.0,
          "unit": "kWh"
        }
      ],
      "items": [
        {
          "record_id": "r001",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope1",
          "category": "diesel_combustion",
          "factor_id": "DEMO_DIESEL_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 40.0,
          "basis_unit": "L",
          "emissions_kgco2e": 107.2,
          "is_demo": true
        },
        {
          "record_id": "r002",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope2",
          "category": "electricity",
          "factor_id": "DEMO_ELEC_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 1080.0,
          "basis_unit": "kWh",
          "emissions_kgco2e": 626.4,
          "is_demo": true
        },
        {
          "record_id": "r003",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope3",
          "category": "electronic_components",
          "factor_id": "DEMO_EEIO_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 10000.0,
          "basis_unit": "CNY",
          "emissions_kgco2e": 3500.0,
          "is_demo": true
        }
      ],
      "factor_versions": [
        "demo-v1"
      ],
      "is_demo": true,
      "warnings": [
        "情景结果基于模拟业务记录和演示排放因子。",
        "节电比例仅调整 Scope 2 用电量；采购减少比例仅调整已确认的 Scope 3 采购金额。",
        "Scope 1 不随上述情景变化；产品 PCF 不自动并入企业总账。"
      ]
    },
    {
      "scenario_id": "sc002",
      "scenario_name": "节电15%＋采购减少5%",
      "baseline_run_id": "run-001",
      "baseline_total_kgco2e": 4303.2,
      "scenario_total_kgco2e": 4023.8,
      "scope_breakdown": {
        "scope1": 107.2,
        "scope2": 591.6,
        "scope3": 3325.0
      },
      "baseline_scope_breakdown": {
        "scope1": 107.2,
        "scope2": 696.0,
        "scope3": 3500.0
      },
      "reduction_kgco2e": 279.4,
      "reduction_rate": 0.06492843,
      "electricity_saving_rate": 0.15,
      "procurement_reduction_rate": 0.05,
      "changed_records": [
        {
          "record_id": "r002",
          "variable": "quantity",
          "before": 1200.0,
          "after": 1020.0,
          "unit": "kWh"
        },
        {
          "record_id": "r003",
          "variable": "amount",
          "before": 10000.0,
          "after": 9500.0,
          "unit": "CNY"
        }
      ],
      "items": [
        {
          "record_id": "r001",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope1",
          "category": "diesel_combustion",
          "factor_id": "DEMO_DIESEL_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 40.0,
          "basis_unit": "L",
          "emissions_kgco2e": 107.2,
          "is_demo": true
        },
        {
          "record_id": "r002",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope2",
          "category": "electricity",
          "factor_id": "DEMO_ELEC_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 1020.0,
          "basis_unit": "kWh",
          "emissions_kgco2e": 591.6,
          "is_demo": true
        },
        {
          "record_id": "r003",
          "company_id": "demo-001",
          "period": "2026-10",
          "scope": "scope3",
          "category": "electronic_components",
          "factor_id": "DEMO_EEIO_01",
          "factor_version": "demo-v1",
          "activity_or_amount": 9500.0,
          "basis_unit": "CNY",
          "emissions_kgco2e": 3325.0,
          "is_demo": true
        }
      ],
      "factor_versions": [
        "demo-v1"
      ],
      "is_demo": true,
      "warnings": [
        "情景结果基于模拟业务记录和演示排放因子。",
        "节电比例仅调整 Scope 2 用电量；采购减少比例仅调整已确认的 Scope 3 采购金额。",
        "Scope 1 不随上述情景变化；产品 PCF 不自动并入企业总账。"
      ]
    }
  ]
}

```
