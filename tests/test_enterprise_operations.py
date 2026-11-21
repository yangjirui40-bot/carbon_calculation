"""Exercise an isolated non-demo tenant from organization setup to formal outputs."""
import os
from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

assert "carbonspeed_test_ops_" in os.environ["DATABASE_URL"]
client = TestClient(app)
api = "/api/v1"
tag = uuid4().hex[:8]
month = "2026-10"
pw = "Fixture-NoProduction-20261120"
checks = []


def req(method, path, expected=200, auth=None, **kwargs):
    result = client.request(method, api+path, headers=auth, **kwargs)
    assert result.status_code == expected, (method, path, result.status_code, result.text[:600])
    return result.json()


def check(title, condition):
    assert condition, title
    checks.append(title)
    print("[OK]", title, flush=True)


def login(name):
    value = req("POST", "/auth/login", data={"username": name, "password": pw})
    return {"Authorization": "Bearer "+value["access_token"]}, value["user"]


def tenant(suffix):
    name = tag+suffix
    req("POST","/auth/register",201,json={"username":name,"email":name+"@example.test","password":pw,"company_name":"碳速算企业试点验收"})
    return login(name)


with client:
    owner, initial = tenant("-owner")
    other, other_user = tenant("-other")
    cid = initial["company_id"]
    op = f"/organization/{cid}"
    control = f"/inventory/{cid}"
    check("自助建账即获企业管理权限", req("GET",op,auth=owner)["can_manage"])
    req("GET",op,403,auth=other)
    check("账套组织数据按企业隔离", True)

    def invitation(role, suf, **extras):
        username = tag+suf
        data = req("POST",op+"/invites",201,auth=owner,json={"email":username+"@example.test","role":role,**extras})
        payload={"token":data["token"],"username":username,"password":pw}
        req("POST","/organization/accept",201,json=payload)
        req("POST","/organization/accept",410,json=payload)
        return login(username)

    reviewer, reviewer_user = invitation("enterprise","-reviewer")
    audit, _ = invitation("auditor","-auditor")
    check("邀请限企业、一次使用并能开通审计员", not req("GET",op,auth=reviewer)["can_manage"])
    revoked=req("POST",op+"/invites",201,auth=owner,json={"email":tag+"-disabled@example.test","role":"enterprise"})
    req("POST",op+f"/invites/{revoked['id']}/revoke",auth=owner)
    req("POST","/organization/accept",410,json={"token":revoked["token"],"username":tag+"-disabled","password":pw})
    check("未接受的邀请可立即撤销", True)

    legal=req("POST",op+"/legal-entities",201,auth=owner,json={"code":"HQ","legal_name":"测试制造有限公司","jurisdiction":"湖南长沙"})
    req("POST",op+"/legal-entities",403,auth=reviewer,json={"code":"HQ2","legal_name":"测试制造二厂有限公司","jurisdiction":"湖南长株潭"})
    east=req("POST",op+"/sites",201,auth=owner,json={"code":"EAST","legal_entity_id":legal["id"],"name":"东厂","region":"湖南长沙"})
    west=req("POST",op+"/sites",201,auth=owner,json={"code":"WEST","legal_entity_id":legal["id"],"name":"西厂","region":"湖南湘潭"})
    req("POST",f"/organization/{other_user['company_id']}/sites",422,auth=other,
        json={"code":"EE","legal_entity_id":legal["id"],"name":"非法引用","region":"湖南湘潭"})
    work=req("POST",op+"/org-units",201,auth=owner,json={"code":"PCBA","site_id":east["id"],"name":"贴装车间","kind":"workshop"})
    line=req("POST",op+"/org-units",201,auth=owner,json={"code":"SMT01","site_id":east["id"],"name":"SMT-01","kind":"line","parent_id":work["id"]})
    check("分企业法人、工厂和产线真实持久化", req("GET",op,auth=owner)["org_units"][1 if work["code"]<line["code"] else 0]["parent_id"]==work["id"])
    version=req("POST",op+"/boundaries",201,auth=owner,json={"code":"FISC","title":"一季度制造边界",
                "consolidation":"equity_share","note":"以企业归属的股权比例核算选定工厂","sites":[{"site_id":east["id"],"share_ratio":"0.5"}]})
    req("POST",control,422,auth=owner,json={"period":month,"boundary":"无结构化版本不可建账"})
    req("POST",control,201,auth=owner,json={"period":month,"boundary":"只纳入东厂实际运营活动","boundary_id":version["id"]})
    req("PUT",control+f"/people/{initial['id']}",auth=owner,json={"duty":"coordinator"})
    req("PUT",control+f"/people/{reviewer_user['id']}",auth=owner,json={"duty":"reviewer"})
    check("企业无需平台管理员即可设置独立盘查与审批", True)
    activity={"company_id":cid,"record_no":tag+"-power","period":month,"category":"electricity","scope":"scope2",
              "factor_id":"MEE_ELEC_2022_NAT","quantity":2000,"unit":"kWh"}
    req("POST","/records",422,auth=owner,json=activity)
    req("POST","/records",422,auth=owner,json={**activity,"site_id":west["id"]})
    req("POST","/records",403,auth=reviewer,json={**activity,"site_id":east["id"]})
    actual=req("POST","/records",201,auth=owner,json={**activity,"site_id":east["id"],"org_unit_id":line["id"]})
    check("组织归集与边界校验在台账入口执行", actual["workshop"]=="贴装车间" and actual["production_line"]=="SMT-01")
    activities=f"/records/{activity['record_no']}"
    update={"action":"correct","expected_revision":1,"quantity":2000,"reason":"核对表计换算原件"}
    changed=req("PATCH",activities+"/adjust",auth=owner,json=update)
    assert changed["review_status"]=="pending"
    req("PATCH",activities+"/adjust",409,auth=owner,json=update)
    req("POST",activities+"/confirm",auth=owner)
    revisions=req("GET",activities+"/revisions",auth=audit)
    check("台账更正及复核保留历史并拒绝并发旧稿", [row["revision_no"] for row in revisions]==[3,2,1])

    integration=req("POST",f"/integrations/{cid}",201,auth=owner,json={"code":"ERP","name":"采购计量系统"})
    headers={"Authorization":"Bearer "+integration["token"],"Idempotency-Key":"ERP-"+tag}
    feed=f"/integrations/feed/{integration['id']}"
    entry={"record_no":"FLOW-1","period":"2026-11","category":"electricity","scope":"scope2","quantity":240,
           "unit":"kWh","factor_id":"MEE_ELEC_2022_NAT","site_code":"EAST","org_unit_code":"SMT01"}
    trail=f"/integrations/{cid}/{integration['id']}/batches"
    req("POST",feed,422,auth=headers,json={"records":[{**entry,"site_code":"MISSING"}]})
    failed=req("GET",trail,auth=owner)[0]["id"]
    failed_rows=req("GET",trail+"/"+str(failed),auth=owner)
    check("ERP拒绝批次持久保留原请求键和错误原因",not failed_rows["rows"] and failed_rows["rejections"][0]["request_key"]==headers["Idempotency-Key"])
    receipt=req("POST",feed,201,auth=headers,json={"records":[entry]})
    retained_rows=req("GET",trail+"/"+str(receipt["batch_id"]),auth=owner)
    check("纠正后重用原幂等键并可按行查成功回执",retained_rows["rows"]==[{"line":1,"source_record_key":"FLOW-1","state":"accepted"}])
    repeated=req("POST",feed,201,auth=headers,json={"records":[entry]})
    assert receipt["imported"]==1 and repeated["replayed"] and receipt["batch_id"]==repeated["batch_id"]
    req("POST",feed,409,auth=headers,json={"records":[{**entry,"quantity":25}]})
    assert req("GET",f"/records/page",auth=owner,params={"period":"2026-11","review_status":"pending","site_id":east["id"]})["total"]==1
    req("POST",f"/integrations/{cid}/{integration['id']}/revoke",auth=owner)
    req("POST",feed,401,auth=headers,json={"records":[entry]})
    check("ERP机器凭证只可接入、同键幂等且可撤销", True)

    custom={"series":"OUTBOUND","category":"scope3_04","activity_unit":"tkm","value":0.4,"valid_from":"2026-10","valid_to":"2026-12",
            "publisher":"供应商试点测算","citation":"运输服务测算说明 TEST-04","gas_coverage":"CO2e","methodology":"测试集假定按吨公里计量"}
    coeff=req("POST",f"/company-factors/{cid}",201,auth=owner,json=custom)
    req("POST",f"/company-factors/{cid}",409,auth=owner,json=custom)
    req("GET",f"/factors/{coeff['factor_id']}",404,auth=other)
    req("POST","/records",422,auth=owner,json={**activity,"record_no":tag+"-freight-future","period":"2027-01",
        "site_id":east["id"],"category":"scope3_04","scope":"scope3","quantity":100,"unit":"tkm","factor_id":coeff["factor_id"]})
    req("POST","/records",201,auth=owner,json={**activity,"record_no":tag+"-freight",
        "site_id":east["id"],"category":"scope3_04","scope":"scope3","quantity":100,"unit":"tkm","factor_id":coeff["factor_id"]})
    check("企业因子有来源、有效期和企业隔离，支持物理量范围3",True)
    flow=req("POST","/calculations/enterprise",auth=owner,json={"company_id":cid,"period":month})
    check("股权比例和工厂归集真实参与核算", flow["success"] and flow["data"]["total_kgco2e"]==556.6
          and any(line.get("original_quantity")==2000 for line in flow["data"]["items"]))
    review_path=control+f"/{month}"
    def submit(run_id, expected=200):
        return req("POST",review_path+"/decision",expected,auth=owner,json={"action":"submit","expected_revision":1,
                       "run_id":run_id,"note":"对边界、数据来源和范围进行审查"})
    submit(flow["run_id"],409)
    assessments=[{"category":i,"status":"included" if i==4 else "unavailable","rationale":"依据运输活动清单" if i==4 else "当前试点尚缺该类数据"} for i in range(1,16)]
    req("PUT",review_path+"/coverage",auth=owner,json={"categories":assessments})
    submit(flow["run_id"],409)
    flow=req("POST","/calculations/enterprise",auth=owner,json={"company_id":cid,"period":month})
    submit(flow["run_id"])
    req("POST",review_path+"/decision",auth=reviewer,json={"action":"close","expected_revision":1,"note":"独立复核确认"})
    result=req("POST","/reports/iso14064",auth=owner,json={"company_id":cid,"run_id":flow["run_id"],"require_closed_period":True})
    check("范围3覆盖与边界冻结到已关账报告", len(result["content"]["scope_assessments"])==15 and result["content"]["internal_approval"]["revision"]==1)
    panel=req("GET",f"/dashboard/company/{cid}/snapshot",auth=audit,params={"run_id":flow["run_id"]})
    check("驾驶舱和审计使用同一工厂排放结果", sum(x["emissions_kgco2e"] for x in panel["production"]["sites"])==556.6)

    pcf_factor=req("POST",f"/company-factors/{cid}",201,auth=owner,json={**custom,"series":"BOMPURCHASE",
        "category":"scope3_01","activity_unit":"CNY","price_basis":"2026 CNY 未税采购价"})
    product_id=tag+"-sensor"
    req("POST","/products",201,auth=owner,json={"company_id":cid,"product_id":product_id,"product_name":"传感器","output_quantity":100})
    req("POST",f"/products/{product_id}/bom",201,auth=owner,json={"bom_items":[{"bom_item_id":"B01","material_name":"铜箔","material_amount":100,
        "matched_category":"scope3_01","matched_factor_id":pcf_factor["factor_id"]}]})
    study_path=f"/product-studies/{product_id}"
    study={"name":"基线材料","start_on":"2026-10-01","end_on":"2026-10-31","boundary_note":"上游 BOM 采购及按需生产分摊"}
    req("POST",study_path,422,auth=owner,json={**study,"allocations":[{"run_id":flow["run_id"],"record_no":activity["record_no"],"share_ratio":"0.5","reason":"测试拒绝按股权缩放活动"}]})
    versioned=req("POST",study_path,201,auth=owner,json=study)
    req("PUT",f"/products/{product_id}/bom/B01/factor",auth=owner,json={"factor_id":"DEMO_EEIO_03"})
    inventory_rows=req("GET",study_path+f"/{versioned['id']}/inventory",auth=owner)
    check("结构化产品清单保留冻结材料、币种与来源",inventory_rows[0]["name"]=="铜箔" and inventory_rows[0]["basis"]=="frozen_bom" and float(inventory_rows[0]["net_amount"])==100)
    from_frozen=req("POST",study_path+f"/{versioned['id']}/calculate",auth=owner)
    check("后续编辑BOM不改变已保存研究版本", from_frozen["success"] and from_frozen["data"]["items"][0]["factor_id"]==pcf_factor["factor_id"])
    retained=req("GET",f"/products/{product_id}/report",auth=owner,params={"run_id":from_frozen["run_id"]})
    assert retained["content"]["study"]["id"]==versioned["id"]
    req("GET",study_path,404 if settings.DB_TENANT_ISOLATION_ENABLED else 403,auth=other)
    req("PUT",f"/products/{product_id}/bom/B01/factor",auth=owner,json={"factor_id":pcf_factor["factor_id"]})
    physical=req("POST",op+"/boundaries",201,auth=owner,json={"code":"PLANT","title":"运营边界",
        "consolidation":"operational_control","note":"纳入东厂，并以实际活动量进行计算","sites":[{"site_id":east["id"]}]})
    req("POST",control,201,auth=owner,json={"period":"2026-11","boundary":"100%东厂运营","boundary_id":physical["id"]})
    erp_record=f"C{cid}-ERP-FLOW-1"
    req("POST",f"/records/{erp_record}/confirm",auth=owner)
    next_month=control+"/2026-11"
    req("PUT",next_month+"/coverage",auth=owner,json={"categories":[{**item,"status":"unavailable"} for item in assessments]})
    production=req("POST","/calculations/enterprise",auth=owner,json={"company_id":cid,"period":"2026-11"})
    req("POST",next_month+"/decision",auth=owner,json={"action":"submit","expected_revision":1,"run_id":production["run_id"],"note":"东厂运营台账送审"})
    req("POST",next_month+"/decision",auth=reviewer,json={"action":"close","expected_revision":1,"note":"核对东厂原始活动"})
    allocation=req("POST",study_path,201,auth=owner,json={**study,"end_on":"2026-11-30","allocations":[
        {"run_id":production["run_id"],"record_no":erp_record,"share_ratio":"0.2","reason":"按订单工时分摊20%"}]})
    allocated=req("POST",study_path+f"/{allocation['id']}/calculate",auth=owner)
    check("产品研究可引用已关账生产活动，并分列BOM与生产", allocated["data"]["production_emissions_kgco2e"]==25.7568
          and allocated["data"]["total_study_emissions_kgco2e"]==65.7568)
    pcf=req("GET",f"/products/{product_id}/report",auth=owner,params={"run_id":allocated["run_id"]})
    assert pcf["content"]["study"]["id"]==allocation["id"]
    report_no=pcf["report_no"]
    for suffix,signature in (("pdf",b"%PDF-"),("xml",b"<?xml")):
        file=client.get(api+f"/reports/{report_no}/download?fmt={suffix}",headers=audit)
        assert file.status_code==200 and file.content.startswith(signature)
    check("研究版本和生产分摊可生成审计可读PDF/XML",True)

    partner=req("POST","/supply-chain/suppliers",201,auth=owner,json={"supplier_id":tag+"-p1","company_id":cid,"name":"零部件合作商"})
    supplier,_=invitation("supplier","-portal",supplier_id=partner["id"])
    req("POST",f"/disclosures/{cid}",201,auth=owner,json={"name":"上游采购披露","period":month,
        "due_on":(date.today()+timedelta(days=10)).isoformat(),"instructions":"填报生产边界、排放量与底稿号","supplier_ids":[partner["id"]]})
    tasks=req("GET","/disclosures/portal",auth=supplier)
    assert len(tasks)==1
    rid=tasks[0]["id"]
    req("POST","/supplier-portal/report",409,auth=supplier,json={"period":month,"reported_emissions":99})
    submission_data={"emissions_kgco2e":"2486.25","intensity":"0.05","boundary":"装配现场上游采购","note":"经授权业务底稿 #OCT1"}
    req("POST",f"/disclosures/portal/{rid}",201,auth=supplier,json=submission_data)
    check("供应商报送未审批前不会进入正式历史", req("GET","/supplier-portal/submissions",auth=supplier)==[])
    req("POST",f"/disclosures/{cid}/{rid}/review",auth=owner,json={"version_no":1,"decision":"return","note":"说明上游排放活动依据"})
    submission_data["note"]="经授权业务底稿 #OCT2，附范围说明"
    req("POST",f"/disclosures/portal/{rid}",201,auth=supplier,json=submission_data)
    req("POST",f"/disclosures/{cid}/{rid}/review",409,auth=owner,json={"version_no":1,"decision":"approve","note":"旧版不可审批"})
    req("POST",f"/disclosures/{cid}/{rid}/review",auth=owner,json={"version_no":2,"decision":"approve","note":"证据与范围已确认"})
    published=req("GET","/supplier-portal/submissions",auth=supplier)
    check("退回补报保留两版，只将批准版写进业务数据", len(published)==1 and published[0]["reported_emissions"]==2486.25)
    denied=req("GET",f"/disclosures/{cid}",403,auth=other)
    check("供应链任务无法被其他租户访问", bool(denied))
    print(f"{len(checks)} enterprise operation checks passed",flush=True)
