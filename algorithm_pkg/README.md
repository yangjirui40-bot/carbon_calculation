# 碳速算：第一阶段基础核算引擎

## 已实现
- Scope 1：燃料活动量法
- Scope 2：外购电力活动量法
- Scope 3：采购金额法（演示类别）
- 排放因子匹配与版本回显
- 数据校验、未确认记录排除、结果汇总
- 自动化单元测试

## 环境
Python 3.10+；EIO-LCA 矩阵计算依赖 NumPy。请执行 `python -m pip install -r requirements.txt`。

## 运行演示
在项目根目录执行：

```bash
python -m models.demo
```

## 运行测试
```bash
python -m unittest discover -s tests -v
```

## 预期结果
Scope 1 = 107.2 kgCO2e  
Scope 2 = 696.0 kgCO2e  
Scope 3 = 3500.0 kgCO2e  
Total = 4303.2 kgCO2e

## 目录
- `models/core.py`：核心核算函数
- `models/factors.py`：演示因子加载
- `models/demo.py`：三笔业务数据演示
- `data/demo_factors.csv`：演示因子
- `tests/test_core.py`：单元测试
- `docs/04_calculation_spec.md`：模型说明书

## 对接后端
核心入口：
```python
from models.core import calculate_company
result = calculate_company(records, factors)
```
`records` 为业务记录列表，`factors` 为以 `factor_id` 为键的因子字典。返回结构包含 `total_kgco2e`、`scope_breakdown`、`items`、`warnings`、`factor_versions`、`is_demo`。


## 第二阶段新增：EIO-LCA 三部门矩阵演示
运行：
```bash
python -m models.run_eiolca_demo
```
测试：
```bash
python -m unittest discover -s tests -v
```
新增文件：
- `models/eiolca.py`：矩阵核算、诊断及输出
- `models/run_eiolca_demo.py`：独立演示入口
- `data/eiolca_demo_parameters.json`：合成参数
- `tests/test_eiolca.py`：EIO-LCA 测试
- `docs/06_eiolca_model.md`：模型说明

特别声明：EIO-LCA 参数是合成演示数据，不是实证数据库；不得与同一采购记录的基础金额法 Scope 3 结果相加。


## 第三阶段新增：产品碳足迹 PCF
运行：
```bash
python -m models.run_product_demo
```
新增文件：
- `models/product_carbon.py`：BOM金额法上游排放与单位分摊
- `models/run_product_demo.py`：控制板模块演示入口
- `tests/test_product_carbon.py`：PCF测试
- `docs/08_product_carbon_model.md`：PCF模型说明与手算验算
边界：当前只核算 BOM 对应采购上游排放估算，不并入企业 Scope 1/2/3 总账。


## 第四阶段新增：减排路径情景模拟
运行：
```bash
python -m models.run_scenario_demo
```
新增文件：
- `models/scenario.py`：情景参数校验、数据副本调整、重新核算和情景比较
- `models/run_scenario_demo.py`：两个预设情景演示
- `data/scenario_demo_parameters.json`：情景参数
- `tests/test_scenario.py`：情景测试
- `docs/10_scenario_model.md`：数学模型与手算验算
注意：只调整 Scope 2 电量与 Scope 3 采购金额；Scope 1 不变；不覆盖基准记录。


## 第五阶段新增：统一计算引擎与后端适配
新增：
- `models/calculation_engine.py`：统一 dispatch、响应封装、run_id
- `models/api_adapter.py`：后端调用适配函数
- `tests/test_engine.py`：统一入口集成测试
- `docs/12_backend_integration_contract.md`：API 对接契约
- `data/*_request.json`：接口请求示例

统一入口：
```python
from models.calculation_engine import calculate
result = calculate({"operation": "enterprise", "payload": {"records": [...]}})
```
注意：本阶段 `run_id` 仅在响应中生成，尚未数据库持久化；需由后端持久化请求快照、因子版本与结果。


## 后端交接
交接范围、安装运行方法、调用方式、后端责任边界和当前限制见 `HANDOFF.md`。
