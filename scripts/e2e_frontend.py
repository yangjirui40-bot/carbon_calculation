# -*- coding: utf-8 -*-
"""端到端验证：模拟前端 React 应用的全部 API 调用流程（同源部署契约）。

运行：python backend/scripts/e2e_frontend.py（需后端已在 127.0.0.1:8000 运行）
"""
import io, json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor"))
import httpx

BASE = "http://127.0.0.1:8000"
ok, fail = [], []
FULL_ACCESS = None

def check(name, resp, expect_status=200, expect_keys=None, content_type=None):
    if resp.status_code != expect_status:
        fail.append(f"{name}: HTTP {resp.status_code} != {expect_status} :: {resp.text[:200]}")
        return None
    ct = resp.headers.get("content-type", "")
    if content_type and content_type not in ct:
        fail.append(f"{name}: content-type {ct}")
        return None
    data = None
    try:
        data = resp.json() if "json" in ct else resp.content
    except Exception:
        data = resp.content
    if expect_keys and isinstance(data, dict):
        missing = [k for k in expect_keys if k not in data]
        if missing:
            fail.append(f"{name}: missing keys {missing}")
            return None
    ok.append(name)
    return data

def req(method, path, token=None, **kw):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    time.sleep(0.6)  # 尊重 RATE_LIMIT_PER_MINUTE 默认 60/min 的限流窗口
    return httpx.request(method, BASE + path, headers=h, timeout=60, **kw)

# ---------- 静态托管 ----------
r = req("GET", "/")
body = check("GET / -> SPA index.html", r, 200, content_type="text/html")
if body:
    ok.append("SPA index contains 碳速算" if "碳速算" in body.decode("utf-8", "ignore") or "root" in body.decode("utf-8", "ignore") else fail.append("SPA index 内容异常"))
    m = __import__("re").search(r'src="(/assets/[^"]+)"', body.decode("utf-8", "ignore"))
    if m:
        r2 = req("GET", m.group(1))
        check(f"GET {m.group(1)} 静态资源", r2, 200)
check("GET /login SPA 回退", req("GET", "/login"), 200, content_type="text/html")
check("GET /dashboard SPA 回退", req("GET", "/dashboard"), 200, content_type="text/html")
check("GET /healthz", req("GET", "/healthz"), 200, expect_keys=["status"])
r = req("GET", "/docs")
check("GET /docs", r, 200, content_type="text/html")
check("GET /metrics", req("GET", "/metrics"), 200)

# ---------- 登录 ----------
def login(u, p):
    r = req("POST", "/api/v1/auth/login", data={"username": u, "password": p})
    d = check(f"login {u}", r, 200, expect_keys=["access_token", "user"])
    return d["access_token"] if d else None

t_admin = login("admin", "admin123")
t_ent = login("enterprise", "enterprise123")
t_aud = login("auditor", "auditor123")
t_sup = login("supplier", "supplier123")

# ---------- admin 全模块 ----------
check("companies 列表", req("GET", "/api/v1/companies", t_admin), 200)
check("factors 列表", req("GET", "/api/v1/factors", t_admin), 200)
check("factors sets", req("GET", "/api/v1/factors/sets", t_admin), 200)
check("documents 列表", req("GET", "/api/v1/documents", t_admin), 200)
check("review-queue", req("GET", "/api/v1/documents/review-queue", t_admin), 200)
check("records 列表", req("GET", "/api/v1/records", t_admin), 200)
check("calculations 列表", req("GET", "/api/v1/calculations", t_admin), 200)
check("eiolca table", req("GET", "/api/v1/calculations/eiolca/table", t_admin), 200)
check("products 列表", req("GET", "/api/v1/products", t_admin), 200)
check("audit logs", req("GET", "/api/v1/audit/logs", t_admin), 200)
check("billing plans", req("GET", "/api/v1/billing/plans", t_admin), 200)
check("system ai-status", req("GET", "/api/v1/system/ai-status", t_admin), 200)
check("system schema", req("GET", "/api/v1/system/schema", t_admin), 200)
check("system jobs", req("GET", "/api/v1/system/jobs", t_admin), 200)

# 驾驶舱（星型模型优先）
for ep in ("summary", "ring", "sankey", "trend", "drilldown"):
    check(f"dashboard {ep}", req("GET", f"/api/v1/dashboard/company/1/{ep}", t_admin), 200)

# 核算与结果
r = req("POST", "/api/v1/calculations/enterprise", t_admin, json={"company_id": 1, "period": "2026-11"})
d = check("POST calculations/enterprise", r, 200)
run_id = None
if isinstance(d, dict):
    run_id = d.get("run_id") or (d.get("result") or {}).get("run_id")
if run_id:
    check("GET calculation detail", req("GET", f"/api/v1/calculations/{run_id}", t_admin), 200)
    check("GET uncertainty", req("GET", f"/api/v1/calculations/{run_id}/uncertainty", t_admin), 200)

# 产品 PCF 全链路
check("product detail p001", req("GET", "/api/v1/products/p001", t_admin), 200)
check("product match", req("POST", "/api/v1/products/p001/match", t_admin, json={}), 200)
check("product calculate", req("POST", "/api/v1/products/p001/calculate", t_admin, json={}), 200)
check("product report", req("GET", "/api/v1/products/p001/report", t_admin, params={"language": "zh"}), 200)

# 减排模拟
check("simulator run", req("POST", "/api/v1/simulator/run", t_admin, json={
    "company_id": 1, "scenario_id": "e2e-s001", "scenario_name": "端到端节电",
    "electricity_saving_rate": 0.12, "procurement_reduction_rate": 0.0}), 200)
check("simulator scenarios", req("GET", "/api/v1/simulator/company/1/scenarios", t_admin), 200)
check("simulator roi", req("POST", "/api/v1/simulator/roi", t_admin, json={
    "capex": 100000, "annual_opex": 5000, "annual_saving": 40000,
    "annual_reduction_kgco2e": 80000, "carbon_price": 100, "project_life": 8,
    "discount_rate": 0.06}), 200)
check("simulator trajectory", req("GET", "/api/v1/simulator/company/1/trajectory", t_admin), 200)

# 供应链
check("suppliers", req("GET", "/api/v1/supply-chain/suppliers", t_admin), 200)
check("edges", req("GET", "/api/v1/supply-chain/edges", t_admin), 200)
check("network", req("GET", "/api/v1/supply-chain/1/network", t_admin), 200)
check("heatmap", req("GET", "/api/v1/supply-chain/1/heatmap", t_admin), 200)
check("quotas", req("GET", "/api/v1/supply-chain/1/quotas", t_admin), 200)
check("reduction-plans", req("GET", "/api/v1/supply-chain/1/reduction-plans", t_admin), 200)
check("sc report", req("GET", "/api/v1/supply-chain/1/report", t_admin), 200)
check("trades", req("GET", "/api/v1/supply-chain/trades", t_admin), 200)
check("company trades", req("GET", "/api/v1/supply-chain/1/trades", t_admin), 200)
check("trades report", req("GET", "/api/v1/supply-chain/1/trades/report", t_admin), 200)

# 报告
r = req("POST", "/api/v1/reports/iso14064", t_admin, json={"company_id": 1, "language": "zh"})
d = check("POST reports/iso14064", r, 200)
if isinstance(d, dict):
    rno = d.get("report_no")
    if rno:
        check("GET report detail", req("GET", f"/api/v1/reports/{rno}", t_admin), 200)
        check("download pdf", req("GET", f"/api/v1/reports/{rno}/download?fmt=pdf", t_admin), 200)
        check("download xml", req("GET", f"/api/v1/reports/{rno}/download?fmt=xml", t_admin), 200)
r = req("POST", "/api/v1/reports/pcf", t_admin, json={"product_id": "p001", "language": "zh"})
d = check("POST reports/pcf", r, 200)
check("reports 列表", req("GET", "/api/v1/reports", t_admin), 200)

# ---------- enterprise 角色 ----------
check("ent companies", req("GET", "/api/v1/companies", t_ent), 200)
check("ent dashboard summary", req("GET", "/api/v1/dashboard/company/1/summary", t_ent), 200)
check("ent records", req("GET", "/api/v1/records", t_ent), 200)
check("ent billing subscription", req("GET", "/api/v1/billing/company/1/subscription", t_ent), 200)

# ---------- supplier 门户 ----------
check("supplier me", req("GET", "/api/v1/supplier-portal/me", t_sup), 200)
check("supplier submissions", req("GET", "/api/v1/supplier-portal/submissions", t_sup), 200)

# ---------- auditor 只读 + 越权 ----------
check("auditor audit logs", req("GET", "/api/v1/audit/logs", t_aud), 200)
r = req("POST", "/api/v1/records", t_aud, json={"company_id": 1, "record_no": "aud-x1",
                                                "period": "2026-11", "category": "electricity",
                                                "quantity": 100, "unit": "kWh", "scope": "scope2",
                                                "factor_id": "MEE_ELEC_2022_NAT"})
check("auditor 写被拒(403)", r, 403)

# ---------- 未认证 401 ----------
check("未认证 401", req("GET", "/api/v1/companies"), 401)

print(f"\nPASS: {len(ok)}  FAIL: {len(fail)}")
for f in fail:
    print("FAIL:", f)
sys.exit(1 if fail else 0)
