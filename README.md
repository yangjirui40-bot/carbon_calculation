# carbon_calculation · 碳速算平台（企业高配完整版）

电子信息制造业全生命周期碳核算平台：智能票据解析 → 排放因子对齐 → 全公司核算 →
驾驶舱 → 减排模拟 → 供应链协同 → 绿色金融审计，前后端一体化、可单机一键跑通。

- 技术栈：FastAPI + PostgreSQL + Redis（后端）/ React 19 + Vite + AntD + ECharts（前端，同源托管）
- 真实 AI 引擎：RapidOCR PP-OCRv4（票据识别）、LayoutLMv3（文档指纹/版面）、
  SBERT bge-small-zh-v1.5（物料-部门匹配）、POMDP 勾稽纠偏、GCN（供应链热点）、EIO-LCA（2017 全国 42 部门真实表）
- 企业级能力：多租户、RBAC、AES-256-GCM 字段加密、全量审计、SHA-256 链式存证、
  Redis 限流、异步任务队列、配额计费、供应商门户、ISO14064/14067/CBAM 报告、Prometheus 监控

## 目录

```
app/             FastAPI 应用（api/ services/ models/ schemas/）
algorithm_pkg/   算法包（Scope1/2/3、PCF、EIO-LCA、情景、引擎）
frontend/        React 前端工程（npm ci && npm run build → frontend/dist）
migrations/      Alembic 迁移（OLTP 3NF 21 表 + OLAP 星型 6 表）
data/io/         2017 全国 42 部门投入产出表（io2017_42sector.csv）
tests/           后端测试（unittest 52/52）
scripts/         运维脚本（e2e_frontend.py、fetch_io_data.py）
部署相关         Dockerfile（多阶段含前端）、docker-compose.yml（含监控 profile）、.github/workflows/ci.yml
```

## 快速开始

### 本机（需 Python 3.12、Node ≥ 20.19、PostgreSQL、Redis）

```bash
# 1. 前端构建（同源托管）
cd frontend && npm ci && npm run build && cd ..

# 2. 数据库/种子（PowerShell 示例；默认 postgresql+psycopg2://carbonspeed:carbonspeed_2026_Db_x7KpQ2@localhost:5433/carbonspeed）
python -m app.seed

# 3. 启动
python run.py            # http://127.0.0.1:8000 = 完整前端 + /api/v1 + /docs + /metrics
```

依赖安装：`pip install -r requirements.txt`（CPU 版 torch 建议先
`pip install torch --index-url https://download.pytorch.org/whl/cpu`）。
Windows 开发机如需离线使用捆绑 vendor，可设 `PYTHONPATH=backend\vendor`。

### Docker 一键（含前端构建）

```bash
docker compose up -d --build              # PostgreSQL + Redis + 后端(含前端) 
docker compose --profile monitoring up -d # 可选：Prometheus + Alertmanager + Grafana
```

AI 模型（首次约 2GB）由 `HF_ENDPOINT=https://hf-mirror.com` 下载到 `models_cache/`；
生产可挂载卷 `carbonspeed-models` 持久化。

## 演示账号（seed 后可用）

| 角色 | 用户名 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | admin | admin123 | 全部企业 + 管理后台 |
| 企业 | enterprise | enterprise123 | 企业 demo-001 |
| 审计员 | auditor | auditor123 | 只读 + 复核队列 |
| 供应商 | supplier | supplier123 | 供应商门户 sup-t1-a |

## 验证结果（本机实测）

- 后端测试 `python -m unittest tests.test_api`：**52/52 通过**（含 EIO-LCA 42 部门、OCR 解析、星型 OLAP、不确定性）
- 前端契约端到端 `python scripts/e2e_frontend.py`（需后端运行）：**67/67 通过**
- OCR 噪声回归：64/66 = 97.0%；压测 20 并发 P50=132ms / P95=441ms / P99=511ms，0 失败
- 核算基准：演示企业 4303.2 kgCO2e；PCF 3470；官方因子集 Scope1=104.0（柴油 2.60）、Scope2=684.36（电力 0.5703）

## 文档

- [交付文档.md](交付文档.md)：78 个接口样本、错误码、服务联通、部署、前端对接约定
- [frontend/README.md](frontend/README.md)：前端工程说明与联调约定
- [data/io/README.md](data/io/README.md)：42 部门投入产出表与 CO2 清单（g 向量）获取指引
