"""Checks for row policies, archived downloads and normalized evidence."""
import os
from hashlib import sha256
from uuid import uuid4
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.config import settings
from app.database import RequestSessionLocal, SessionLocal, authorize_tenant
from app.main import app
from app.models import Report, ReportArtifact, SourceDocument
from app.services.ai.invoice_verify import verify_invoice
from app.tenant_security import BILATERAL, CHILDREN, OWNER_COLUMNS

assert "carbonspeed_test_ops_" in os.environ["DATABASE_URL"]
tag = uuid4().hex[:8]
password = "Only-Isolated-Test-2026"
api = "/api/v1"
client = TestClient(app)


def check(title, result=True):
    assert result, title
    print("[OK]", title, flush=True)


def create_account(label):
    name = tag + "-" + label
    created = client.post(api+"/auth/register", json={
        "username": name, "email": name+"@example.test", "password": password, "company_name": name,
    })
    assert created.status_code == 201, created.text
    auth = client.post(api+"/auth/login", data={"username": name, "password": password}).json()
    return auth["user"]["company_id"], {"Authorization": "Bearer "+auth["access_token"]}


with client:
    first, auth = create_account("a")
    second, other = create_account("b")
    key = {"id": "same-id", "period": "2026-11", "category": "electricity",
           "scope": "scope2", "factor_id": "MEE_ELEC_2022_NAT",
           "review_status": "confirmed", "quantity": 2000, "unit": "kWh"}

    output = client.post(api+"/calculations/enterprise", headers=auth, json={
        "company_id": first,
        "records": [key, {**key, "quantity": 1000}, {**key, "review_status": "pending"}],
    })
    assert output.status_code == 200, output.text
    result = output.json()
    assert result["success"], result
    assert result["data"]["total_kgco2e"] == 1609.8
    run_no = result["run_id"]
    trace = client.get(api+f"/audit/run/{run_no}/trace", headers=auth).json()
    check("审计页面按归档分录显示重名记录和未确认项",
          [row["emissions_kgco2e"] for row in trace["records"]] == [1073.2, 536.6, None])
    output = client.post(api+"/reports/iso14064", headers=auth, json={"company_id": first, "run_id": run_no})
    assert output.status_code == 200, output.text
    report_no = output.json()["report_no"]
    detail = client.get(api+"/reports/"+report_no, headers=auth).json()
    check("生成报告同时归档两种文件", set(a["format"] for a in detail["artifacts"]) == {"pdf", "xml"})
    for metadata in detail["artifacts"]:
        fmt = metadata["format"]
        with patch("app.services.report_archive.render", side_effect=AssertionError("必须直接读取档案")):
            response = client.get(api+f"/reports/{report_no}/download", params={"fmt": fmt}, headers=auth)
        check(fmt+" 文件字节、体积和摘要一致",
              response.status_code == 200 and response.headers["X-Report-Archive"] == "archived"
              and sha256(response.content).hexdigest() == metadata["sha256"]
              and len(response.content) == metadata["size_bytes"])
    check("跨企业读取核算和报告均被拦截",
          client.get(api+"/calculations/"+run_no, headers=other).status_code == 404
          and client.get(api+f"/reports/{report_no}/download", headers=other).status_code == 404)

    with RequestSessionLocal() as session:
        check("数据库请求角色无所有者和越权能力", session.scalar(text("SELECT current_user")) == "carbon_request")
        active = session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND row_security_active(to_regclass(table_name))")).scalars().all()
        check("已登记的核心业务表实际经过 RLS", set(active) == set(OWNER_COLUMNS) | set(CHILDREN) | set(BILATERAL))
        def count(table):
            return session.scalar(text(f"SELECT count(*) FROM {table}"))
        check("未设身份的裸 SQL 看不到受保护行", count("calculation_inputs") == count("reports") == 0)
        authorize_tenant(session, first, "enterprise")
        values = session.execute(text(
            "SELECT input_line_no, emissions_kgco2e FROM emission_result_lines ORDER BY line_no"
        )).all()
        check("同名输入独立绑定，未确认明细不出排放分录",
              count("calculation_inputs") == 3 and values == [(1, 1073.2), (2, 536.6)])
        session.commit()
        check("提交后新事务恢复同一企业上下文", count("report_artifacts") == 2)
        authorize_tenant(session, second, "enterprise")
        check("无过滤条件的跨租户 SQL 也看不到目标行", count("calculation_runs") == count("report_artifacts") == 0)
        check("跨租户 UPDATE 无效", session.execute(text("UPDATE reports SET title = 'unauthorized'")).rowcount == 0)
        try:
            session.execute(text("INSERT INTO reports (report_no, company_id, report_type, title, language, status, created_at, updated_at) VALUES ('denied', :company, 'ISO14064', 'denied','zh','generated', now(), now())"), {"company": first})
        except DBAPIError as error:
            assert error.orig.pgcode == "42501"
            check("跨租户 INSERT 被数据库拒绝")
        else:
            raise AssertionError("RLS 对越权写入未生效")
        session.rollback()
        authorize_tenant(session, first, "auditor")
        check("审计角色同租户可读但不能改", count("reports") == 1 and session.execute(text("UPDATE reports SET title = 'no'")).rowcount == 0)
        authorize_tenant(session, first, "enterprise")
        try:
            session.execute(text("UPDATE report_artifacts SET size_bytes = 10"))
        except DBAPIError as error:
            assert error.orig.pgcode == "42501"
            check("报告文件归档禁止请求角色改写")
        else:
            raise AssertionError("档案可被请求角色改写")

    with RequestSessionLocal() as session:
        check("会话关闭后，池中连接不会带出上一用户权限",
              session.scalar(text("SELECT count(*) FROM reports")) == 0)

    with SessionLocal() as session:
        report = session.query(Report).filter_by(report_no=report_no).one()
        artifact = session.get(ReportArtifact, (report.id, "pdf"))
        check("数据库归档文件已加密", not artifact.content.startswith(b"%PDF"))
        legacy = Report(report_no=tag+"-legacy", company_id=first, report_type="ISO14064", run_id=run_no,
                        title=report.title, language="zh", content=report.content)
        session.add(legacy)
        session.commit()
        legacy_number = legacy.report_no
    response = client.get(api+f"/reports/{legacy_number}/download", headers=auth)
    check("旧报告按已保存内容继续可下载且标明历史状态",
          response.status_code == 200 and response.headers["X-Report-Archive"] == "legacy-rendered")

    fields = {"invoice_no": "00001", "invoice_date": "2026-11-01", "total_amount": 4}
    check("无授权验真配置时正确走人工核对", verify_invoice(fields)["status"] == "unverified")
    with SessionLocal() as session:
        source = SourceDocument(company_id=first, file_name="isolated-invoice.pdf", verified_status="failed")
        session.add(source)
        session.commit()
        source_id = source.id
    attempt = client.post(api+f"/documents/{source_id}/verify", headers=auth)
    check("服务不可用时保留上一次正式查验结论",
          attempt.status_code == 200 and attempt.json()["verified_status"] == "failed"
          and attempt.json()["verify_attempt_status"] == "unverified")
    history = client.get(api+f"/documents/{source_id}/history", headers=auth).json()
    check("查验尝试落到历史表，其他租户读不到",
          history["verifications"][0]["state"] == "unverified"
          and client.get(api+f"/documents/{source_id}/history", headers=other).status_code == 404)
    scenario = client.post(api+"/simulator/run", headers=auth, json={
        "company_id": first, "scenario_id": tag+"-saving", "scenario_name": "节电方案",
        "electricity_saving_rate": 0.2, "procurement_reduction_rate": 0.1, "baseline_run_id": run_no,
        "finance": {"capex": 10000, "annual_opex": 100, "annual_saving": 2500, "project_life": 3},
    })
    assert scenario.status_code == 200, scenario.text
    analysis = scenario.json()
    assert analysis["success"]
    path = api+f"/simulator/company/{first}/scenarios/{tag}-saving/details"
    detail = client.get(path, headers=auth).json()
    check("情景参数和现金流与实际算法快照一致",
          detail["run_id"] == analysis["run_id"] and len(detail["measures"]) == 3 and len(detail["cashflows"]) == 13
          and any(line["amount"] == -10000 for line in detail["cashflows"])
          and client.get(path, headers=other).status_code == 403)
    with SessionLocal.begin() as session:
        from app.models import CalculationRun
        old = CalculationRun(
            run_id=tag+"-pre-release", operation="scenario", company_id=first, status="success",
            algorithm_version="historical", request_snapshot={},
            result={"scenario_id":tag+"-old", "assumptions":{"electricity_saving_rate":0.09},
                    "projection":{"forecast":[{"period":"2026-12","baseline_kgco2e":25,"scenario_kgco2e":20}]}},
        )
        session.add(old)
    from app.services.history_migration import migrate
    migrate()
    migrate()
    old_path=api+f"/simulator/company/{first}/scenarios/{tag}-old/details"
    old_detail=client.get(old_path,headers=auth).json()
    check("历史情景两次回填无重复，无现金流的旧版本保留空值",
          len(old_detail["projections"]) == len(old_detail["measures"]) == 1 and not old_detail["cashflows"])

    with patch.multiple(settings, INVOICE_VERIFY_ENABLED=True, INVOICE_VERIFY_API_BASE="https://verification.example.test",
                        INVOICE_VERIFY_API_KEY="fixture-token"):
        provider_response = lambda data: httpx.Response(200, json=data, request=httpx.Request("POST", "https://verification.example.test/verify"))
        with patch("httpx.post", return_value=provider_response({"valid": False, "message": "never returned"})):
            check("服务明确否决才标记验真未通过", verify_invoice(fields)["status"] == "failed")
        with patch("httpx.post", return_value=provider_response({"valid": "false"})):
            check("验真异常格式不会误判为有效", verify_invoice(fields)["status"] == "unverified")
        with patch("httpx.post", return_value=provider_response({"valid": True})):
            check("验真服务明确通过才记录查验有效", verify_invoice(fields)["status"] == "verified")
