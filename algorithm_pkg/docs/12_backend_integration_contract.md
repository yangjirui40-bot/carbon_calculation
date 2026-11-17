# 第五阶段：统一计算引擎与后端对接说明 v0.5

## 1. 对接原则

后端统一调用 `models.calculation_engine.calculate(request)`。本层只负责路由、输入校验、统一响应封装和调用现有模型，不重复编写公式。

## 2. 支持的 operation

| operation | 必需 payload | 用途 |
|---|---|---|
| enterprise | records | 企业 Scope 1/2/3 核算 |
| eiolca | purchase_vector_cny | EIO-LCA 矩阵演示 |
| product | product, bom_items | 产品 BOM 上游排放估算 |
| scenario | baseline_records | 减排情景模拟 |

## 3. 统一响应结构

```json
{
  "success": true,
  "run_id": "run-xxxxxxxxxxxx",
  "operation": "enterprise",
  "status": "success",
  "generated_at": "ISO-8601 UTC timestamp",
  "data": {},
  "warnings": [],
  "model_version": "carbon-engine-v0.4"
}
```

- `run_id`：本次计算唯一编号。
- `operation`：执行的计算类型。
- `status`：success/error。
- `data`：对应模型计算结果。
- `warnings`：演示参数、边界或数据质量提示。
- `model_version`：计算引擎版本。

## 4. 后端调用示例

```python
from models.api_adapter import handle_calculation

@app.post("/api/v1/carbon/calculate")
def calculate_carbon(request: dict):
    result = handle_calculation(request)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result)
    return result
```

本算法包不强制安装 FastAPI；上述代码放在后端已有 FastAPI 项目中使用。不要在算法包内部另起一个服务，除非后端负责人明确要求。

## 5. 输入样例

完整 JSON 示例见：
- `data/enterprise_request.json`
- `data/product_request.json`
- `data/eiolca_request.json`

情景输入结构：
```json
{
  "operation": "scenario",
  "payload": {
    "baseline_run_id": "run-001",
    "scenario_id": "sc001",
    "scenario_name": "节电10%",
    "electricity_saving_rate": 0.10,
    "procurement_reduction_rate": 0,
    "baseline_records": []
  }
}
```

## 6. 重要接口边界

1. 当前 `run_id` 是响应级唯一编号；尚未接入数据库持久化。
2. 因子文件默认读取 `data/demo_factors.csv`，生产环境应由后端传入经过审核的因子集合。
3. `run_id`、结果、输入快照和因子版本尚未写入数据库；持久化由后端负责或下一阶段共同实现。
4. 当前错误统一返回 `success=false` 和 `warnings`，后端可据此映射 HTTP 400。
5. EIO-LCA 当前为合成矩阵演示；不得作为实证行业因子。
6. PCF 仅覆盖 BOM 采购上游金额法估算。
7. 情景模拟当前只调整 Scope 2 用电和 Scope 3 采购金额。
