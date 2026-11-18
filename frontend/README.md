# 碳速算 · 前端（Carbon Ledger）

电子信息制造业碳核算平台的前端工程。React + TypeScript + Vite + Ant Design + ECharts，所有业务数字来自后端，前端不维护第二套核算公式。

## 环境要求

- Node.js ≥ 20.19（本机验证使用 Node 24.14.1 / npm 11.11.0）
- 后端默认地址 `http://localhost:8000`，统一接口前缀 `/api/v1`
- 浏览器：Chrome / Edge 最新版

## 快速开始

```cmd
cd frontend
npm ci
copy .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5173
```

打开 <http://127.0.0.1:5173>。`.env.local` 中的 `VITE_API_BASE_URL` 指向后端地址，默认 `http://localhost:8000`。

> 交付包未包含 `node_modules`、`dist` 与 `.env.local`，请使用 `npm ci` 安装锁定依赖后自行创建 `.env.local`。

## 构建与预览

```cmd
npm run build      # node ./scripts/tsc.mjs -b && vite build，产物在 dist/
npm run preview    # 本地预览 dist
npm run lint       # oxlint
```

> `scripts/tsc.mjs` 负责定位 TypeScript 7 的原生编译器（`@typescript/typescript-win32-x64`），跨平台版本会自动落到对应平台的包名；请勿删除该启动器。

`VITE_API_BASE_URL` 在**构建时**注入；部署到其他环境时请在构建前设置，或直接使用同域反向代理。

## 演示账号（本地种子库）

| 角色 | 用户名 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | admin | admin123 | 全部企业、管理后台 |
| 企业 | enterprise | enterprise123 | 企业 1（demo-001） |
| 审计员 | auditor | auditor123 | 只读 |
| 供应商 | supplier | supplier123 | sup-t1-a 供应商门户 |

若后端重建为干净种子库，只有 admin 存在；企业/审计员/供应商账号需由管理员在“管理后台 → 账号开通”创建（供应商编号填 `sup-t1-a`，企业编号填 `1`）。

## 目录结构

```
src/
  api/            接口客户端与 15 个业务模块（client.ts、types.ts、modules/）
  components/     通用组件、瑞士风格组件（swiss/）、图表容器（charts/）
  config/         导航、角色、业务常量、AntD 主题
  context/        公司上下文（carbonspeed.companyId）
  layouts/        主应用壳层与供应商壳层
  pages/          按业务域划分的页面
  router/         路由表与权限守卫
  styles/         设计令牌与全局样式
  utils/          格式化、图表主题
```

## 后端联调约定

- 登录：`POST /api/v1/auth/login`，`application/x-www-form-urlencoded`（`username`、`password`），返回 `access_token`；后续请求带 `Authorization: Bearer <token>`。
- 会话存储：`localStorage.carbonspeed.session`，结构 `{ token, user }`；企业选择存 `localStorage.carbonspeed.companyId`。
- 错误响应：后端 `{ "detail": "..." }` 由 `src/api/client.ts` 归一为 Error，页面直接展示后端原文。
- 接口清单位于 `src/api/modules/*`：auth、documents、records、factors、calculations、products、simulator、dashboard、supplyChain、audit、reports、billing、system、companies、supplierPortal。
- 上传：`POST /api/v1/documents/upload?company_id=<id>&doc_type=invoice`，multipart 字段名 `file`。
- 审计导出返回 JSON 体，由前端自建 Blob 下载。
- CORS：后端 `CORS_ORIGINS=*` 可本地联调；正式环境请按实际域名配置。

## 页面清单（主要路由）

- 总览：`/workspace`、`/dashboard`
- 数据：`/documents`、`/documents/:id/review`、`/records`、`/factors`
- 核算：`/calculations`、`/calculations/eiolca`、`/results/:runId`、`/products`、`/products/:productId`
- 报告：`/reports`、`/reports/:reportNo`
- 分析：`/simulator`
- 协同：`/supply-chain`、`/supply-chain/suppliers`、`/supply-chain/quotas`、`/supply-chain/trades`
- 审计：`/audit`、`/audit/runs/:runId`
- 设置/后台：`/billing`、`/admin/companies`、`/admin/users`、`/system`
- 供应商门户：`/supplier`、`/supplier/report`、`/supplier/submissions`

## 已知限制与后端对接说明

1. 配额交易需要至少两家企业；单企业演示库只展示对账摘要、表单与空状态。
2. OCR 为**真实引擎**（RapidOCR PP-OCRv4），票据上传后异步解析并返回字段与置信度；仅当模型文件缺失时才回退到内置 Mock 引擎（CI 中以 `SKIP_OCR=1` 跳过 OCR 段落）。
3. 系统页 `/system` 的 AI 状态来自 `GET /api/v1/system/ai-status`：LayoutLMv3（文档指纹）、SBERT（bge-small-zh-v1.5 产品匹配）、LLM 勾稽（未配置 DeepSeek sk- key 时自动使用内置规则引擎）均已部署；SER 默认关闭（公开检查点质量不合格，待自有标注数据微调后启用），产品匹配在 SER 关闭时走 SBERT+规则回退，口径请以 ai-status 为准。
4. 产品、BOM、供应商、配额、减排计划为“只增不改”设计；企业信息与排放记录有更新/删除接口。
5. 账号开通页只有开通入口（`POST /auth/users`），暂无账号列表接口。
6. 单据原图预览后端暂无文件下载接口，预览面板展示元信息。
7. 审计导出接口返回 JSON 体，由前端自建 Blob 下载。

## 交付说明

- `package-lock.json` 已锁定依赖，请使用 `npm ci` 而不是 `npm install`；使用 pnpm 的环境可用 `pnpm install --frozen-lockfile`。
- 数据层为 PostgreSQL（本地 5433 端口容器 carbonspeed-db）+ Redis（carbonspeed-redis），不使用 SQLite；测试数据由后端仓库根目录的 `app/seed.py` 生成。
- 同源部署：执行 `npm run build` 生成 `dist/` 后，后端会自动托管该产物——`http://localhost:8000` 直接提供完整前端（SPA 回退已内置），无需单独启动 Vite。
- 后端接口与字段以 FastAPI 实际路由为准；若接口有变更，优先同步更新 `src/api/modules` 与 `src/api/types.ts`。
