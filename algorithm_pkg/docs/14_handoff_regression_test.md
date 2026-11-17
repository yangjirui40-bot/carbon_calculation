# 后端交付前回归测试

命令：`python -m unittest discover -s tests -v`

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
test_eiolca_dispatch (test_engine.TestUnifiedEngine.test_eiolca_dispatch) ... ok
test_enterprise_dispatch (test_engine.TestUnifiedEngine.test_enterprise_dispatch) ... ok
test_missing_payload_returns_error_envelope (test_engine.TestUnifiedEngine.test_missing_payload_returns_error_envelope) ... ok
test_product_dispatch (test_engine.TestUnifiedEngine.test_product_dispatch) ... ok
test_scenario_comparison_integration (test_engine.TestUnifiedEngine.test_scenario_comparison_integration) ... ok
test_unknown_operation_returns_error_envelope (test_engine.TestUnifiedEngine.test_unknown_operation_returns_error_envelope) ... ok
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
Ran 30 tests in 0.004s

OK

```

结果：30 项测试全部通过。此结果不代表真实业务或端到端验收完成。
