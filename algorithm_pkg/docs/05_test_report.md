# 第一阶段测试记录

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

----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK

```

演示运行退出码：0

```json
{
  "company_id": "demo-001",
  "period": "2026-10",
  "total_kgco2e": 4303.2,
  "scope_breakdown": {
    "scope1": 107.2,
    "scope2": 696.0,
    "scope3": 3500.0
  },
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
      "activity_or_amount": 1200.0,
      "basis_unit": "kWh",
      "emissions_kgco2e": 696.0,
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
  "excluded_record_ids": [],
  "warnings": [],
  "factor_versions": [
    "demo-v1"
  ],
  "is_demo": true
}

```
