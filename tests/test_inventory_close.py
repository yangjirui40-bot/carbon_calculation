"""Integration tests for monthly carbon inventory on a disposable PostgreSQL."""
import os
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

assert os.environ["DATABASE_URL"].rsplit("/", 1)[-1].startswith("carbonspeed_test_")
api = "/api/v1"
tag = uuid4().hex[:8]
month = "2026-10"
code = f"GOV-{tag}"
checks = []


def expect(label, response, status):
    assert response.status_code == status, (label, response.status_code, response.text[:400])
    checks.append(label)
    print("[OK]", label, flush=True)
    return response.json() if response.content and "json" in response.headers.get("content-type", "") else None


with TestClient(app) as client:
    def auth(name, password):
        response = client.post(api + "/auth/login", data=dict(username=name, password=password))
        assert response.is_success
        return {"Authorization": "Bearer " + response.json()["access_token"]}

    admin = auth("admin", "admin123")
    pw = f"Fixture-{tag}-only"
    owner = expect("企业账号可独立开通", client.post(api + "/auth/register", json={
        "username": code, "email": f"{code}@example.test", "password": pw, "company_name": "月度盘查验收企业",
    }), 201)
    cid = owner["company_id"]
    submitter = auth(code, pw)

    def employee(suffix, role):
        name = code + suffix
        user = expect(f"创建{suffix}账号", client.post(api + "/auth/users", headers=admin, json={
            "username": name, "email": f"{name}@example.test", "password": pw, "role": role, "company_id": cid,
        }), 201)
        return user["id"], auth(name, pw)

    reviewer_id, reviewer = employee("-review", "enterprise")
    _, auditor = employee("-audit", "auditor")
    path = f"{api}/inventory/{cid}"
    expect("普通企业成员不能配置期间", client.post(path, headers=reviewer, json={
        "period": month, "boundary": "贴装车间购电与燃料",
    }), 403)
    expect("建立本企业期间与边界", client.post(path, headers=admin, json={
        "period": month, "boundary": "贴装车间购电与燃料",
    }), 201)
    for id_, role in [(owner["id"], "coordinator"), (reviewer_id, "reviewer")]:
        expect("分离负责人和复核人", client.put(f"{path}/people/{id_}", headers=admin, json={"duty": role}), 200)

    def line(no, quantity=100):
        return dict(company_id=cid, record_no=no, period=month, category="electricity", scope="scope2",
                    factor_id="MEE_ELEC_2022_NAT", unit="kWh", quantity=quantity)

    def record(no, actor=submitter):
        return client.post(api + "/records", headers=actor, json=line(no))

    def calculate(inline=False):
        body = {"company_id": cid, "period": month}
        if inline:
            body["records"] = [{**line(code + "-inline"), "id": code + "-inline", "review_status": "confirmed"}]
        result = expect("按选定月份核算", client.post(api + "/calculations/enterprise", headers=submitter, json=body), 200)
        assert result["success"]
        return result["run_id"]

    def decide(action, actor, run=None, revision=1):
        return client.post(f"{path}/{month}/decision", headers=actor, json={
            "action": action, "expected_revision": revision, "note": "复核范围与当期原始活动数据", "run_id": run,
        })

    expect("复核人无法修改本月台账", record(code+"-review", reviewer), 403)
    expect("经办人可归集数据", record(code+"-1"), 201)
    expect("内联估算无法送审", decide("submit", submitter, calculate(inline=True)), 409)
    stale = calculate()
    expect("新增台账后旧快照不能送审", record(code+"-2"), 201)
    expect("重新计算前缺数据的快照被阻止", decide("submit", submitter, stale), 409)
    pending = line(code+"-erp"); pending.pop("company_id")
    expect("ERP 数据落入待复核队列", client.post(api + "/records/sync", headers=submitter,
                                                   json={"company_id": cid, "records": [pending]}), 201)
    expect("有待复核数据不能送审", decide("submit", submitter, calculate()), 409)
    expect("经办人确认台账", client.post(api + "/records/" + code + "-erp/confirm", headers=submitter), 200)
    run = calculate()
    expect("提交后冻结台账", decide("submit", submitter, run), 200)
    expect("送审人不能自行关账", decide("close", submitter), 403)
    expect("审计账号不能关账", decide("close", auditor), 403)
    expect("送审期间禁止新增", record(code+"-3"), 409)
    expect("送审期间禁止删除", client.delete(api + "/records/" + code + "-1", headers=submitter), 409)
    expect("送审期间禁止修改车间", client.put(api + "/records/" + code + "-1/classification",
                                               headers=submitter, json={"workshop": "SMT"}), 409)
    expect("送审期间禁止 ERP 写入", client.post(api + "/records/sync", headers=submitter,
                                                   json={"company_id": cid, "records": [{**pending, "record_no": code+"-4"}]}), 409)
    staged_upload = "record_no,period,category,scope,quantity,unit,factor_id"
    csv = (staged_upload + f"\n{code}-before,2026-11,electricity,scope2,20,kWh,MEE_ELEC_2022_NAT"
           + f"\n{code}-locked,{month},electricity,scope2,20,kWh,MEE_ELEC_2022_NAT").encode()
    expect("跨月批量导入遇到冻结月份整批拒绝", client.post(api + "/records/import", headers=submitter,
           params={"company_id": cid}, files={"file": ("close.csv", csv, "text/csv")}), 409)
    untouched = client.get(api + "/records/page", headers=submitter, params={"company_id": cid, "period": "2026-11"}).json()
    assert untouched["total"] == 0
    photo = Path("/app/tests/fixtures/invoice_demo.png").read_bytes()
    document = expect("锁账期间可先保存原始资料", client.post(api + "/documents/upload", headers=submitter,
                 params={"company_id": cid, "doc_type": "electricity_bill"},
                 files={"file": ("energy.png", photo, "image/png")}), 201)
    expect("原始票据也不能入账至冻结月份", client.post(api + f"/documents/{document['id']}/review",
           headers=submitter, json={**line("locked-document"), "review_status": "confirmed"}), 409)
    def report():
        return client.post(api + "/reports/iso14064", headers=submitter, json={
            "company_id": cid, "run_id": run, "require_closed_period": True,
        })
    expect("未关账无法生成已关账清单", report(), 409)
    expect("独立复核人关账", decide("close", reviewer), 200)
    approved = expect("关账清单保留内部审批元数据", report(), 200)
    assert approved["content"]["internal_approval"]["revision"] == 1
    number = approved["report_no"]
    exported = client.get(api + f"/reports/{number}/download?fmt=xml", headers=auditor)
    expect("审计员可导出关账清单", exported, 200)
    assert "InternalPeriodClose" in exported.text
    expect("独立复核人可以更正重开", decide("reopen", reviewer), 200)
    expect("旧版本请求被拒", decide("submit", submitter, run), 409)
    expect("重开后旧快照不可再次送审", decide("submit", submitter, run, 2), 409)
    expect("重开后旧快照不能生成新关账清单", report(), 409)
    expect("重开后继续补录", record(code+"-adjust"), 201)
    expect("重开后发布新版快照", decide("submit", submitter, calculate(), 2), 200)
    expect("独立复核人可退回补正", decide("return", reviewer, revision=2), 200)
    events = expect("只读审计员查看完整历史", client.get(f"{path}/{month}/history", headers=auditor), 200)
    assert [event["action"] for event in events] == ["return", "submit", "reopen", "close", "submit", "open"]
    print(f"{len(checks)} governance checks passed", flush=True)
