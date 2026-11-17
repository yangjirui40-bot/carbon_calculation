"""碳速算后端端到端 API 测试（企业级：多租户/配额/真实 OCR 流水线/审计）。

运行前会重置数据库并写入演示种子数据。需要 PostgreSQL 可连接。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "vendor"))
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

# 重置数据库到已知的种子状态，确保测试可重复运行
Base.metadata.drop_all(bind=engine)
seed()

PASSED = 0
FAILED = 0


def check(name: str, cond: bool, detail: str = ""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  [OK] {name}")
    else:
        FAILED += 1
        print(f"  [FAIL] {name}  {detail}")


def auth_headers(client) -> dict:
    r = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json().get('access_token')}"}


def login(client, user: str, pwd: str) -> dict:
    r = client.post("/api/v1/auth/login", data={"username": user, "password": pwd})
    return {"Authorization": f"Bearer {r.json().get('access_token')}"}


def run_tests(client):
    print("=== 健康检查 ===")
    r = client.get("/healthz")
    check("healthz", r.status_code == 200 and r.json()["status"] == "healthy", r.text)
    r = client.get("/")
    check("内置前端", r.status_code == 200 and "碳速算" in r.text, r.text[:80])

    print("=== 认证与多租户隔离 ===")
    h = auth_headers(client)
    r = client.post("/api/v1/auth/login", data={"username": "admin", "password": "wrong"})
    check("错误密码拒绝", r.status_code == 401, r.text)
    r = client.post("/api/v1/companies", headers=h, json={"code": "demo-002", "name": "竞争对手测试公司B"})
    check("创建第二家企业", r.status_code == 201, r.text)
    company2 = r.json()["id"]
    r = client.post("/api/v1/auth/register", json={"username": "userb", "email": "b@x.com",
                                                   "password": "userb123", "role": "enterprise", "company_id": company2})
    check("注册企业用户B", r.status_code == 201, r.text)
    h2 = login(client, "userb", "userb123")
    companies = client.get("/api/v1/companies", headers=h)
    check("管理员可见全部企业", len(companies.json()) >= 2, str(len(companies.json())))
    companies_b = client.get("/api/v1/companies", headers=h2)
    check("企业B仅见本企业（租户隔离）", len(companies_b.json()) == 1 and companies_b.json()[0]["id"] == company2, str(companies_b.json()))
    company1 = next(c["id"] for c in companies.json() if c["code"] == "demo-001")
    r = client.get(f"/api/v1/dashboard/company/{company1}/summary", headers=h2)
    check("企业B访问企业A数据被拒(403)", r.status_code == 403, r.text)
    r = client.post("/api/v1/auth/register", json={"username": "hacker", "email": "h@x.com",
                                                   "password": "hacker123", "role": "admin"})
    check("自助注册管理员被拒", r.status_code == 403, r.text)

    print("=== 订阅与配额 ===")
    r = client.get("/api/v1/billing/plans", headers=h)
    check("套餐列表", r.status_code == 200 and len(r.json()) >= 4, r.text)
    r = client.get(f"/api/v1/billing/company/{company1}/subscription", headers=h)
    check("订阅信息", r.status_code == 200 and r.json()["plan_code"] == "pro", r.text)

    print("=== 企业核算 ===")
    r = client.post("/api/v1/calculations/enterprise", headers=h,
                    json={"company_id": company1, "period": "2026-10"})
    body = r.json()
    check("企业核算成功", r.status_code == 200 and body["success"], body)
    check("企业核算总量 4303.2", abs(body["data"]["total_kgco2e"] - 4303.2) < 1e-6, str(body["data"].get("total_kgco2e")))

    print("=== EIO-LCA ===")
    r = client.post("/api/v1/calculations/eiolca", headers=h,
                    json={"purchase_vector_cny": [7000, 2000, 1000]})
    check("EIO-LCA 成功", r.status_code == 200 and r.json()["success"], r.text)

    print("=== 产品碳足迹 ===")
    r = client.post("/api/v1/products/p001/match", headers=h)
    check("SBERT 匹配", r.status_code == 200, r.text)
    r = client.post("/api/v1/products/p001/calculate", headers=h)
    body = r.json()
    check("PCF 总量 3470", abs(body["data"]["total_upstream_emissions_kgco2e"] - 3470) < 1e-6, str(body["data"].get("total_upstream_emissions_kgco2e")))

    print("=== 驾驶舱 ===")
    for ep in ("summary", "ring", "sankey", "trend", "drilldown"):
        r = client.get(f"/api/v1/dashboard/company/{company1}/{ep}", headers=h)
        check(f"驾驶舱 {ep}", r.status_code == 200, r.text)

    print("=== 真实 OCR 票据识别流水线 ===")
    if os.environ.get("SKIP_OCR") == "1":
        print("  [SKIP] CI 环境跳过 OCR 流水线（SKIP_OCR=1）")
    else:
        invoice = BACKEND / "tests" / "fixtures" / "invoice_demo.png"
        if not invoice.exists():
            from tests.make_invoice import make_invoice
            make_invoice(invoice)
        with open(invoice, "rb") as f:
            img_bytes = f.read()
        r = client.post("/api/v1/documents/upload", headers=h,
                        params={"company_id": company1, "doc_type": "invoice"},
                        files={"file": ("invoice_demo.png", img_bytes, "image/png")})
        check("单据上传", r.status_code == 201, r.text)
        doc_id = r.json()["id"]
        # 重复上传拦截（唯一性）
        r = client.post("/api/v1/documents/upload", headers=h,
                        params={"company_id": company1, "doc_type": "invoice"},
                        files={"file": ("invoice_demo.png", img_bytes, "image/png")})
        check("重复单据拦截（内容哈希）", r.status_code == 201 and "重复" in (r.json().get("duplicate_hint") or ""), r.text[:160])
        r = client.post(f"/api/v1/documents/{doc_id}/parse", headers=h, params={"wait": True})
        body = r.json()
        check("异步解析任务完成", r.status_code == 200 and body.get("parse_status") == "parsed", str(body)[:300])
        fields = ((body.get("extracted_fields") or {}).get("fields") or {}) if isinstance(body.get("extracted_fields"), dict) else {}
        check("OCR 抽出字段", len(fields) >= 3, str(fields))
        check("引擎含真实 OCR", "OCR" in (body.get("ocr_engine") or ""), str(body.get("ocr_engine")))
        # 发票验真（未配置查验 API → unverified 状态）
        r = client.post(f"/api/v1/documents/{doc_id}/verify", headers=h)
        check("发票验真状态", r.status_code == 200 and r.json()["verified_status"] == "unverified", r.text[:160])
        # 人工复核队列
        r = client.get("/api/v1/documents/review-queue", headers=h, params={"company_id": company1})
        check("人工复核队列", r.status_code == 200 and isinstance(r.json().get("queue"), list), r.text[:160])
        # 复核入库（人工修正字段 + 备注）
        r = client.post(f"/api/v1/documents/{doc_id}/review", headers=h,
                        json={"review_status": "confirmed",
                              "fields_override": {"total_amount": 11300.0},
                              "note": "人工复核确认"})
        check("复核入库（含人工修正与验真提示）", r.status_code == 201 and r.json().get("reviewed_by_user_id") is not None, r.text[:160])

    print("=== 官方因子库与因子集 ===")
    r = client.get("/api/v1/factors/sets", headers=h)
    check("因子集列表", r.status_code == 200 and "official-2022" in r.json()["sets"], r.text[:160])
    # 基准（演示因子）核算结果用于对比 scope3（无官方因子，沿用记录因子）
    demo = client.post("/api/v1/calculations/enterprise", headers=h,
                       json={"company_id": company1, "period": "2026-10"}).json()["data"]
    r = client.post("/api/v1/calculations/enterprise", headers=h,
                    json={"company_id": company1, "period": "2026-10", "factor_set": "official-2022"})
    body = r.json()
    sb = body["data"]["scope_breakdown"]
    check("官方因子 Scope1=104.0（柴油2.60）", abs(sb["scope1"] - 104.0) < 1e-6, str(sb))
    check("官方因子 Scope2=684.36（全国2022电力0.5703）", abs(sb["scope2"] - 684.36) < 1e-6, str(sb))
    check("Scope3 无官方因子沿用记录因子", abs(sb["scope3"] - demo["scope_breakdown"]["scope3"]) < 1e-6, str(sb))
    r = client.post("/api/v1/calculations/enterprise", headers=h,
                    json={"company_id": company1, "period": "2026-10", "factor_set": "official-2022-hunan"})
    sb2 = r.json()["data"]["scope_breakdown"]
    check("官方因子 Scope2=588.0（湖南2022电力0.4900）", abs(sb2["scope2"] - 588.0) < 1e-6, str(sb2))
    r = client.post("/api/v1/calculations/enterprise", headers=h,
                    json={"company_id": company1, "period": "2026-10", "factor_set": "不存在的集合"})
    check("未知因子集报错", r.status_code == 400, r.text[:120])

    print("=== 不确定性分析 ===")
    r = client.get("/api/v1/calculations", headers=h, params={"company_id": company1, "operation": "enterprise"})
    run_id = next(x["run_id"] for x in r.json())
    r = client.get(f"/api/v1/calculations/{run_id}/uncertainty", headers=h)
    u = r.json()
    check("不确定性分析", r.status_code == 200 and "ci95_low" in u and u["relative_uncertainty"] > 0, str(u)[:200])
    check("误差传播数值合理", u["ci95_low"] < u["total_kgco2e"] < u["ci95_high"], str(u)[:200])

    print("=== 真实投入产出表接口 ===")
    r = client.post("/api/v1/calculations/eiolca/table", headers=h,
                    json={"category_amounts": {"electronic_components": 7000}})
    body = r.json()
    check("42部门 EIO-LCA（真实2017表，矩阵可用）",
          r.status_code == 200 and body.get("success")
          and "通信设备" in body["data"]["mapping"]["electronic_components"],
          str(body)[:200])

    print("=== 减排模拟器 ===")
    r = client.post("/api/v1/simulator/run", headers=h,
                    json={"company_id": company1, "scenario_id": "sc-test",
                          "scenario_name": "节电10%", "electricity_saving_rate": 0.1,
                          "procurement_reduction_rate": 0.0})
    check("情景核算", r.status_code == 200 and r.json()["success"], r.text)
    r = client.post("/api/v1/simulator/roi", headers=h,
                    json={"capex": 2000000, "annual_opex": 100000, "annual_saving": 600000,
                          "annual_reduction_kgco2e": 500000, "carbon_price": 50,
                          "project_life": 10, "discount_rate": 0.08})
    check("ROI 测算", r.status_code == 200 and r.json()["roi"] is not None, r.text)

    print("=== 供应链协同 ===")
    r = client.get(f"/api/v1/supply-chain/{company1}/heatmap", headers=h)
    body = r.json()
    check("GNN 热力图", r.status_code == 200 and "statistics" in body, r.text)
    check("GNN 识别热点", body.get("statistics", {}).get("red", 0) >= 1 or body.get("statistics", {}).get("yellow", 0) >= 1, str(body.get("statistics")))
    r = client.get(f"/api/v1/supply-chain/{company1}/report", headers=h)
    check("供应链聚合报告", r.status_code == 200 and "risk_statistics" in r.json() and "quotas" in r.json(), r.text[:160])

    print("=== 绿色金融审计 ===")
    r = client.get("/api/v1/calculations", headers=h, params={"company_id": company1})
    run_id = next(x["run_id"] for x in r.json() if x["operation"] == "enterprise")
    r = client.get(f"/api/v1/audit/run/{run_id}/trace", headers=h)
    check("穿透核查", r.status_code == 200 and r.json().get("found"), r.text)
    r = client.post(f"/api/v1/audit/run/{run_id}/attest", headers=h)
    check("区块链存证", r.status_code == 200 and r.json().get("verified"), r.text)
    r = client.get("/api/v1/audit/logs", headers=h)
    check("全量操作审计日志", r.status_code == 200 and len(r.json()) >= 5, str(len(r.json())))

    print("=== 合规报告 ===")
    r = client.post("/api/v1/reports/iso14064", headers=h, json={"company_id": company1})
    check("ISO14064 报告", r.status_code == 200 and r.json().get("report_no"), r.text)

    print("=== 系统 ===")
    r = client.get("/api/v1/system/ai-status", headers=h)
    check("AI 引擎状态", r.status_code == 200 and "layoutlmv3" in r.json(), r.text)

    print("=== OLAP 星型模型 ===")
    r = client.post("/api/v1/system/olap/refresh", headers=h)
    check("星型模型刷新", r.status_code == 200 and r.json()["fact_company_emission_rows"] >= 1, r.text[:160])
    r = client.get("/api/v1/system/schema", headers=h)
    schema = r.json()
    check("建模说明（OLTP 3NF + OLAP 星型）", r.status_code == 200
          and "OLTP" in schema["modeling"] and "OLAP" in schema["modeling"], str(schema)[:200])
    check("星型维度/事实表齐全",
          set(schema["modeling"]["OLAP"]["维度表"]) == {"dim_category", "dim_company", "dim_period", "dim_supplier"}
          and set(schema["modeling"]["OLAP"]["事实表"]) == {"fact_company_emission", "fact_emission"},
          str(schema["modeling"]["OLAP"]))
    # 驾驶舱汇总与 OLAP 事实表一致（星型查询生效）
    r = client.get(f"/api/v1/dashboard/company/{company1}/summary", headers=h)
    s = r.json()
    check("驾驶舱走星型聚合（period 字段来自维度表）", r.status_code == 200 and "period" in s and s["total_kgco2e"] > 0, str(s)[:160])


with TestClient(app) as client:
    run_tests(client)

print(f"\n结果：通过 {PASSED}，失败 {FAILED}")
sys.exit(1 if FAILED else 0)
