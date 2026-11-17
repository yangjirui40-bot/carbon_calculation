# 碳核算算法包｜后端交接说明

**交付版本：** v0.5（算法模块交付版）  
**交付对象：** 后端负责人  
**技术语言：** Python  
**当前定位：** 可独立运行、可由后端导入调用的算法模块；不是完整后端服务。

## 1. 本次交付包含

| 模块 | 入口文件 | 功能 |
|---|---|---|
| 企业基础核算 | `models/core.py` | Scope 1、Scope 2、Scope 3 基础核算与汇总 |
| EIO-LCA | `models/eiolca.py` | 三部门投入产出矩阵、Leontief 逆矩阵、完全排放强度 |
| 产品碳足迹 | `models/product_carbon.py` | 根据 BOM 金额和类别因子计算上游排放估算及单位产品排放 |
| 减排情景 | `models/scenario.py` | 调整用电量/采购金额，重新计算并比较情景 |
| 统一计算入口 | `models/calculation_engine.py` | 按 operation 路由模型、统一响应结构、生成 run_id |
| 后端适配器 | `models/api_adapter.py` | 提供 `handle_calculation(request_json)` 供 FastAPI 路由调用 |

## 2. 安装与运行

建议 Python 3.10 或以上版本。

```bash
# 在项目根目录
python -m pip install -r requirements.txt

# 运行企业基础核算演示
python -m models.demo

# 运行 EIO-LCA 演示
python -m models.run_eiolca_demo

# 运行产品 BOM 演示
python -m models.run_product_demo

# 运行减排情景演示
python -m models.run_scenario_demo

# 运行全部自动化测试
python -m unittest discover -s tests -v
```

## 3. 后端调用方式

推荐由后端负责人在其 FastAPI 项目中导入，不需要把本算法包另行启动成一个服务：

```python
from models.api_adapter import handle_calculation

result = handle_calculation(request_json)
```

也可以直接调用统一入口：

```python
from models.calculation_engine import calculate

result = calculate(request_json)
```

统一入口支持以下 `operation`：

- `enterprise`：企业 Scope 1/2/3 核算，`payload.records` 必填；
- `eiolca`：EIO-LCA，`payload.purchase_vector_cny` 必填；
- `product`：产品 BOM 核算，`payload.product` 和 `payload.bom_items` 必填；
- `scenario`：减排情景，`payload.baseline_records` 必填。

请求 JSON 示例见 `data/` 目录。详细响应结构及 FastAPI 接入示例见 `docs/12_backend_integration_contract.md`。

## 4. 后端需要负责的工作

1. 按项目既定 API 契约接收前端请求，不要直接把算法包当前的 `operation` 当作最终对外 API 路径。
2. 将数据库中的业务记录转换为算法输入字段；字段映射需与业务负责人确认。
3. 将正式排放因子作为受控数据传入算法，不应在生产环境继续使用演示因子。
4. 持久化核算任务、原始输入快照、因子版本、算法版本、结果和异常信息。
5. 提供结果查询接口，并将结果返回前端展示。
6. 与算法负责人共同完成真实业务数据的联调和验收。

## 5. 重要边界与未完成事项

- `data/demo_factors.csv` 中的排放因子均为演示设定，不是经核验的官方或实测因子。
- EIO-LCA 的投入产出矩阵 `A` 和直接排放强度 `g` 为合成演示参数，不是正式行业数据库。
- Scope 3 当前基础核算使用采购金额法演示因子；EIO-LCA 是独立矩阵演示路径。对同一笔采购不得把两种结果直接相加。
- 产品 PCF 当前只覆盖 BOM 对应的采购上游金额法估算，不是完整生命周期评价；PCF 结果不自动并入企业 Scope 1/2/3 总账。
- 情景模拟当前只按比例调整已确认的 Scope 2 用电量和 Scope 3 采购金额；Scope 1 不变。
- 当前 `run_id` 在计算响应时生成，尚未接数据库持久化。
- 当前算法包尚未完成 OCR/LLM 文档解析适配。
- 当前尚未与项目真实 FastAPI、数据库和前端完成联调。

## 6. 测试情况

交付前执行：

```bash
python -m unittest discover -s tests -v
```

当前项目共 **30 项自动化测试，全部通过**。测试范围包括基础计算、输入校验、矩阵性质、PCF、情景模拟及统一入口路由。该结果仅说明本算法包当前测试集通过，不等同于真实业务验收或系统端到端验收。

## 7. 文件结构

```text
carbon_speed_phase1/
├── models/       # 算法核心与统一入口
├── data/         # 演示因子、参数与请求 JSON 示例
├── tests/        # 自动化测试
├── docs/         # 计算说明、测试报告、接口契约
├── README.md
├── HANDOFF.md
└── requirements.txt
```
