# 第三阶段 PCF 与全项目回归测试记录

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
test_category_factor_mismatch_rejected (test_product_carbon.TestProductCarbon.test_category_factor_mismatch_rejected) ... ok
test_duplicate_bom_id_rejected (test_product_carbon.TestProductCarbon.test_duplicate_bom_id_rejected) ... ok
test_expected_total_and_unit_result (test_product_carbon.TestProductCarbon.test_expected_total_and_unit_result) ... ok
test_negative_amount_rejected (test_product_carbon.TestProductCarbon.test_negative_amount_rejected) ... ok
test_unmatched_factor_rejected (test_product_carbon.TestProductCarbon.test_unmatched_factor_rejected) ... ok
test_zero_output_rejected (test_product_carbon.TestProductCarbon.test_zero_output_rejected) ... ok

----------------------------------------------------------------------
Ran 18 tests in 0.003s

OK

```

PCF 演示退出码：0

```json
{
  "product_id": "p001",
  "product_name": "控制板模块",
  "output_quantity": 1000.0,
  "product_unit": "件",
  "total_upstream_emissions_kgco2e": 3470.0,
  "unit_product_emissions_kgco2e": 3.47,
  "unit_label": "kgCO2e/件",
  "items": [
    {
      "bom_item_id": "b001",
      "material_name": "电子元器件",
      "category": "electronic_components",
      "material_amount_cny": 7000.0,
      "factor_id": "DEMO_EEIO_01",
      "factor_version": "demo-v1",
      "factor_kgco2e_per_cny": 0.35,
      "emissions_kgco2e": 2450.0,
      "is_demo": true
    },
    {
      "bom_item_id": "b002",
      "material_name": "PCB基板",
      "category": "pcb_materials",
      "material_amount_cny": 2000.0,
      "factor_id": "DEMO_EEIO_02",
      "factor_version": "demo-v1",
      "factor_kgco2e_per_cny": 0.45,
      "emissions_kgco2e": 900.0,
      "is_demo": true
    },
    {
      "bom_item_id": "b003",
      "material_name": "包装纸盒",
      "category": "packaging_materials",
      "material_amount_cny": 1000.0,
      "factor_id": "DEMO_EEIO_03",
      "factor_version": "demo-v1",
      "factor_kgco2e_per_cny": 0.12,
      "emissions_kgco2e": 120.0,
      "is_demo": true
    }
  ],
  "factor_versions": [
    "demo-v1"
  ],
  "boundary": "BOM采购上游排放估算；不包含完整生命周期各阶段",
  "is_demo": true,
  "warnings": [
    "结果仅覆盖当前BOM明细对应的采购上游排放估算。",
    "该结果是独立产品核算，不得直接加到企业Scope 1/2/3总账。"
  ]
}

```

EIO-LCA 回归演示退出码：0
