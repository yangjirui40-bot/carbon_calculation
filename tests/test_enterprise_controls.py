"""End-to-end isolation, two-person control, replay, and evidence on a disposable tenant."""
import io
import os
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from uuid import uuid4

from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

assert "carbonspeed_test_ops_" in os.environ["DATABASE_URL"]
client = TestClient(app)
tag = uuid4().hex[:9]
password = "Fixture-" + uuid4().hex
checks = []


def req(method,path,auth=None,status=200,**kwargs):
    r = client.request(method,"/api/v1"+path,headers=auth,**kwargs)
    assert r.status_code == status, (path,status,r.status_code,r.text[:650])
    return r.json()


def check(label, test):
    assert test,label
    checks.append(label)
    print("[OK]",label,flush=True)


def login(name):
    data = req("POST","/auth/login",data={"username":name,"password":password})
    return {"Authorization":"Bearer "+data["access_token"]},data["user"]


def register(suffix):
    name = tag+suffix
    req("POST","/auth/register",status=201,json={"username":name,"password":password,"email":name+"@example.test","company_name":name})
    return login(name)


with client:
    owner,who = register("-owner")
    outsider,other = register("-other")
    cid = who["company_id"]
    org = f"/organization/{cid}"
    inventory = f"/inventory/{cid}"
    energy = f"/energy/{cid}"
    journal = f"/supply-chain/{cid}"
    month = "2026-10"
    work = f"/period-work/{cid}/{month}"
    name = tag+"-review"
    invite = req("POST",org+"/invites",owner,201,json={"role":"enterprise","email":name+"@example.test"})
    req("POST","/organization/accept",status=201,json={"token":invite["token"],"username":name,"password":password})
    reviewer,second = login(name)
    legal = req("POST",org+"/legal-entities",owner,201,json={"code":"HQ","legal_name":"质量验收制造","jurisdiction":"湖南长沙"})
    site = req("POST",org+"/sites",owner,201,json={"code":"EAST","name":"东厂","region":"湖南长沙","legal_entity_id":legal["id"]})["id"]
    boundary = req("POST",org+"/boundaries",owner,201,json={"code":"OPS","title":"运营控制","consolidation":"operational_control",
        "note":"本企业东厂全部实际经营数据","sites":[{"site_id":site}]})
    req("POST",inventory,owner,201,json={"period":month,"boundary":"实际运营工厂","boundary_id":boundary["id"]})
    for person,duty in ((who,"coordinator"),(second,"reviewer")):
        req("PUT",inventory+"/people/"+str(person["id"]),owner,json={"duty":duty})
    req("PUT",inventory+"/"+month+"/coverage",owner,json={"categories":[{"category":i,"status":"unavailable","rationale":"当期暂无支持本类别的数据"}
        for i in range(1,16)]})
    original = req("GET",f"/billing/company/{cid}/subscription",owner)["usage_documents"]
    upload = "/documents/upload"
    req("POST",upload,owner,422,params={"company_id":cid},files={"file":("bad.png",b"not a picture","image/png")})
    check("无效文件未扣单据额度",req("GET",f"/billing/company/{cid}/subscription",owner)["usage_documents"] == original)
    data=io.BytesIO()
    Image.new("RGB",(32,20),(0,127,30)).save(data,"PNG")
    proof=req("POST",upload,owner,201,params={"company_id":cid,"doc_type":"energy_certificate"},files={"file":("retirement.png",data.getvalue(),"image/png")})
    doc_id=proof["id"]
    stored=req("GET",f"/documents/{doc_id}/history",owner)
    check("上传原件摘要和分页尺寸按实际字节保存",stored["original"]["sha256"]==sha256(data.getvalue()).hexdigest() and stored["pages"]==[{"page":1,"width_px":32,"height_px":20}])
    check("单据用量仅记一次",req("GET",f"/billing/company/{cid}/usage-events",owner)[0]["quantity"]==1)
    req("POST",f"/documents/{doc_id}/parse",owner,422)
    credit={"site_id":site,"proof_id":doc_id,"issuer":"Registry","serial":tag,"period_from":month,"period_to":month,"retirement_reference":"注销-"+tag,"credited_kwh":"75"}
    cert=req("POST",energy,owner,201,json=credit)["id"]
    req("POST",energy,owner,409,json={**credit,"issuer":"REGISTRY","serial":tag.upper()})
    req("GET",energy,outsider,403)
    check("凭证规范编号去重且限本企业访问",True)
    act={"record_no":"P-"+tag,"company_id":cid,"category":"electricity","scope":"scope2","unit":"kWh","quantity":60,
         "factor_id":"MEE_ELEC_2022_NAT","period":month,"site_id":site}
    req("POST","/records",owner,201,json=act)
    b=other["company_id"]
    req("POST","/records",outsider,201,json={**act,"record_no":"OTH-"+tag,"company_id":b,"site_id":None})
    check("企业刷新不会清空其他企业事实",req("GET",energy+"/warehouse/history",owner)[0]["activities"]==1)
    def calc():
        return req("POST","/calculations/enterprise",owner,json={"company_id":cid,"period":month})
    factory=f"/factory/{cid}"
    meter=req("POST",factory+"/meters",owner,201,json={"code":"GRID01","site_id":site,"unit":"MWh","installed_on":"2026-01-01"})["id"]
    read=f"{factory}/meters/{meter}/readings"
    item={"month":"2026-11","consumed":1.25,"factor_id":act["factor_id"]}
    metered=req("POST",read,owner,201,json=item)
    history=req("GET","/records/"+metered["record_no"]+"/revisions",owner)[0]["record"]
    check("表计实耗按原单位保留、换算并等待复核",float(metered["quantity"])==1250 and metered["review_status"]=="pending" and history["meter_unit"]=="MWh")
    check("同月相同读数重试复用原台账",req("POST",read,owner,201,json=item)["replayed"])
    req("POST",read,owner,409,json={**item,"consumed":2})
    req("GET",factory,outsider,403)
    budget=f"/dashboard/company/{cid}/budgets/2026"
    req("PUT",budget,owner,json={"annual_limit_kgco2e":1000})
    allocation={"site_id":site,"month":month,"amount":650}
    req("POST",factory+"/allocations",owner,json=allocation)
    req("POST",factory+"/allocations",owner,409,json={**allocation,"amount":1100})
    req("PUT",budget,owner,409,json={"annual_limit_kgco2e":600})
    check("月度预算超额被拒，年度上限无法低于已分配额度",float(req("GET",factory,owner)["budgets"][0]["amount"])==650)
    old=calc()
    url=energy+f"/{cert}/allocations"
    payload={"record_no":act["record_no"],"applied_kwh":"41","request_key":"retry-"+tag}
    def parallel(i):
        return client.post("/api/v1"+url,headers=owner,json={**payload,"request_key":payload["request_key"]+str(i)})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(parallel,[0,1]))
    assert sorted(r.status_code for r in responses)==[200,409],[(r.status_code,r.text) for r in responses]
    idx=next(i for i,r in enumerate(responses) if r.status_code==200)
    payload["request_key"]+=str(idx)
    rid=responses[idx].json()["id"]
    check("并发分配不超证书或台账，重试不重复入账",req("POST",url,owner,json=payload)["id"]==rid)
    req("POST",url,owner,409,json={**payload,"applied_kwh":4})
    req("PATCH","/records/"+act["record_no"]+"/adjust",owner,409,json={"expected_revision":1,"action":"correct","reason":"更正读数","quantity":10})
    def submit(run,status):
        return req("POST",inventory+"/"+month+"/decision",owner,status,json={"action":"submit","expected_revision":1,"note":"完成凭证和采集工单核对","run_id":run})
    submit(old["run_id"],409)
    req("POST",energy+f"/allocations/{rid}/cancel",owner,json={"reason":"分配原件更正"})
    check("撤销恢复余额且记录理由",float(req("GET",energy,owner)["items"][0]["remaining_kwh"])==75 and req("GET",energy+"/allocations",owner)["items"][0]["cancellation_reason"]=="分配原件更正")
    actual=req("POST",url,owner,json={**payload,"request_key":"actual-"+tag})["id"]
    run=calc()
    check("核算冻结实物覆盖电量，保持位置法总量",run["data"]["electricity_certificates"][0]["id"]==actual and run["data"]["total_kgco2e"]==old["data"]["total_kgco2e"])
    input_={"title":"核对东厂电表与发票","owner_id":who["id"],"site_id":site,"due_date":"2026-11-05"}
    task=req("POST",work+"/collection",owner,201,json=input_)
    issue=req("POST",work+"/quality",owner,201,json={**input_,"title":"复核重复电量"})
    submit(run["run_id"],409)
    inbox=f"/period-work/{cid}/inbox/messages"
    messages=req("GET",inbox,owner)
    msg=messages[0]["id"]
    req("POST",inbox+f"/{msg}/read",reviewer,404)
    check("责任人收到派工消息，仅本人可签收",len(messages)==2 and req("POST",inbox+f"/{msg}/read",owner)["read"])
    for kind,item in [("collection",task),("quality",issue)]:
        ep=work+"/"+kind+"/"+str(item["id"])
        req("POST",ep,reviewer,403,json={"version":1,"action":"submit","note":"非本人工作"})
        req("POST",ep,owner,json={"version":1,"action":"submit","note":"核实电表与原件","evidence_id":doc_id})
        req("POST",ep,owner,403,json={"version":2,"action":"accept","note":"自我复核"})
        req("POST",ep,reviewer,json={"version":2,"action":"return","note":"请补核注销量"})
        req("POST",ep,owner,409,json={"version":1,"action":"submit","note":"过期的任务版本"})
        req("POST",ep,owner,json={"version":3,"action":"submit","note":"补核注销量后提交"})
        req("POST",ep,reviewer,json={"version":4,"action":"accept","note":"与原件一致"})
    check("采集与阻断问题均须独立复核，退回和旧版本受控",all(r["state"]=="closed" for r in req("GET",work,reviewer)["items"]))
    submit(run["run_id"],200)
    req("POST",energy+f"/allocations/{actual}/cancel",owner,409,json={"reason":"已送审不得撤销"})
    req("POST",inventory+"/"+month+"/decision",reviewer,json={"action":"close","expected_revision":1,"note":"独立批准最终盘查"})
    report=req("POST","/reports/iso14064",owner,json={"company_id":cid,"run_id":run["run_id"],"require_closed_period":True})
    check("关账报告携带核销原件编号和完整摘要",report["content"]["electricity_certificates"][0]["proof_sha256"]==stored["original"]["sha256"])
    import json
    from zipfile import ZipFile
    delivery="/evidence-delivery/"+report["report_no"]
    assert req("GET",delivery,owner)["current"]
    req("POST",delivery+"/finance",owner,422,json={"revenue_cny":10000,"proof_id":doc_id})
    revenue=req("POST",upload,owner,201,params={"company_id":cid,"doc_type":"revenue_evidence"},files={"file":("revenue.png",data.getvalue(),"image/png")})["id"]
    check("普通经办人单据列表隐藏营收底稿，仍可见一般凭证",
          doc_id in {v["id"] for v in req("GET","/documents",reviewer)} and revenue not in {v["id"] for v in req("GET","/documents",reviewer)})
    for suffix in ["","/preview","/history"]:
        req("GET",f"/documents/{revenue}"+suffix,reviewer,403)
    req("POST",upload,reviewer,403,params={"company_id":cid,"doc_type":"revenue_evidence"},files={"file":("revenue.png",data.getvalue(),"image/png")})
    check("财务底稿的元数据、原件预览、处理历史与上传接口均受同一权限控制",req("GET",f"/documents/{revenue}",owner)["id"]==revenue)
    sheet=req("POST",delivery+"/finance",owner,201,json={"revenue_cny":20000,"proof_id":revenue})
    vals={v["code"]:float(v["value"]) for v in sheet["metrics"]}
    check("真实关账排放与同企业收入原件生成万元收入强度",abs(vals["carbon_intensity_per_10000_cny"]*2-vals["period_emissions"])<1e-5)
    args={"name":"测试融资接收方","scope":"仅交付本月盘查资料","purpose":"finance","days":2}
    req("POST",delivery+"/recipients",reviewer,403,json=args)
    recipient=req("POST",delivery+"/recipients",owner,201,json=args)["id"]
    req("POST",delivery+"/finance",owner,201,json={"revenue_cny":12000,"proof_id":revenue})
    path=delivery+"/"+str(recipient)
    packet=client.post("/api/v1"+path+"/package",headers=owner)
    assert packet.status_code==200,(packet.status_code,packet.text[:100] if packet.status_code!=200 else "")
    with ZipFile(io.BytesIO(packet.content)) as zipfile:
        files=json.loads(zipfile.read("manifest.json"))["files"]
        check("新增底稿不改变已登记交付所引用的版本",json.loads(zipfile.read("finance.json"))["assessment_id"]==sheet["id"])
        check("融资包内PDF、XML、收入底稿逐件验摘要",len(files)==3 and "finance.json" in files and all(sha256(zipfile.read(n)).hexdigest()==digest for n,digest in files.items()))
    req("POST",path+"/revoke",owner)
    req("POST",path+"/package",owner,410)
    check("撤销交付后禁止重复导出",req("GET",delivery,owner)["recipients"][0]["state"]=="revoked")
    quota={"company_id":cid,"year":2027,"allocated_quota":100}
    req("POST","/supply-chain/quotas",owner,201,json=quota)
    req("POST","/supply-chain/quotas",owner,409,json=quota)
    trade=req("POST","/supply-chain/trades",owner,201,json={"seller_company_id":cid,"buyer_company_id":b,"year":2027,"amount":20,"price":2})
    req("POST","/supply-chain/trades/"+trade["trade_id"]+"/accept",outsider,json={})
    sides=[req("GET",f"/supply-chain/{c}/journal",h)[0] for c,h in ((cid,owner),(b,outsider))]
    check("配额成交双方流水对应同一单号且守恒",all(s["reference"]==trade["trade_id"] for s in sides) and sum(float(s["allocated_delta"]) for s in sides)==0)
    req("POST",journal+"/reduction-plans",owner,201,json={"company_id":cid,"plan_id":tag,"title":"节能改造"})
    req("PATCH",journal+"/reduction-plans/"+tag,owner,json={"progress":0.5,"note":"工程验收完成一半"})
    check("减排实施记录包含原进度与操作者",req("GET",journal+"/progress-history",owner)[0]["actor"]==who["id"])
    sources=req("GET","/calculations/eiolca/datasets/catalog",owner)
    assert len(sources[0]["sectors"])==42
    result=req("POST","/calculations/eiolca/table",owner,json={"dataset_id":sources[0]["id"],"category_amounts":{"packaging_materials":10000}})["data"]
    basis=f"/company-factors/{cid}"
    ix=req("POST",basis+"/prices",owner,201,json={"source_year":2026,"target_year":2017,"region_code":"CN","multiplier":"0.8","publisher":"隔离测试来源","citation":"测试采购价格底稿第 1 行"})["id"]
    info={"dataset_id":sources[0]["id"],"category_amounts":{"packaging_materials":12500},"company_id":cid,"price_index_id":ix,"purchase_year":2026}
    converted=req("POST","/calculations/eiolca/table",owner,json=info)["data"]
    req("POST","/calculations/eiolca/table",owner,422,json={**info,"purchase_year":2023})
    check("采购按已登记来源折价，不接受年份错配",abs(converted["total_kgco2e"]-result["total_kgco2e"])<1e-6 and converted["price_adjustment"]["source_year"]==2026)
    args={"series":"GAS01","category":"natural_gas","activity_unit":"m3","valid_from":"2026-01","publisher":"测试机构","citation":"测试分项底稿","gas_coverage":"有来源的温室气体","methodology":"与实测质量和单位一致","components":{"CO2":2,"N2O":0.01}}
    factor=req("POST",basis,owner,201,json=args)
    req("POST",basis,owner,422,json={**args,"series":"BADSET","components":{"GAS-X":13}})
    check("分气体系数按所选 AR6 版本折算且未知气体被拒",abs(factor["value"]-4.73)<1e-9 and "GWP100" in req("GET",basis+"/bases",owner)["gwp"]["edition"])
    check("42部门估算绑定版本、CO2口径和2017年价格",result["dataset_digest"]==sources[0]["digest"] and result["total_kgco2e"]>0 and sum(result["y_cny"])==10000)
print(len(checks),"enterprise controls checks passed")
