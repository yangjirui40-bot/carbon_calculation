"""Security/numerical regression. Run only after test_api on an isolated DB."""
import os,sys,uuid,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
if not os.environ.get('DATABASE_URL','').rsplit('/',1)[-1].startswith('carbonspeed_test'):
    raise SystemExit('An isolated carbonspeed_test database is required')
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, CalculationRun, EmissionFactor
from app.services.ai.ser import aggregate_entities,word_windows
from app.services.uncertainty import analyze
from app.services.io_tables import load_g,derive_scope3_factors,run_eiolca_42
from models.core import _number,CalculationError
passed=[]
def check(name,condition):
    if not condition:raise AssertionError(name)
    passed.append(name);print('[OK]',name,flush=True)
def headers(client,name,password):
    r=client.post('/api/v1/auth/login',data={'username':name,'password':password});assert r.status_code==200
    return {'Authorization':'Bearer '+r.json()['access_token']}
with TestClient(app) as c:
    admin=headers(c,'admin','admin123');suffix=uuid.uuid4().hex[:8]
    users=[]
    for i in range(2):
        name=f'quality-{suffix}-{i}'
        r=c.post('/api/v1/auth/register',json={'username':name,'email':name+'@example.test','password':'Qatest-2026','company_name':'Independent tenant '+str(i)})
        check('self registration creates independent tenant '+str(i),r.status_code==201 and r.json()['company_id'] is not None)
        users.append((r.json(),headers(c,name,'Qatest-2026')))
    a,ha=users[0];b,hb=users[1]
    check('tenant IDs are distinct',a['company_id']!=b['company_id'])
    r=c.post('/api/v1/auth/register',json={'username':'intrude-'+suffix,'email':suffix+'@example.test','password':'Qatest-2026','company_id':a['company_id']})
    check('cannot self-join existing tenant',r.status_code==403)
    for endpoint in [f"/api/v1/companies/{a['company_id']}",f"/api/v1/dashboard/company/{a['company_id']}/summary"]:
        check('cross tenant denied '+endpoint,c.get(endpoint,headers=hb).status_code==403)
    r=c.get('/api/v1/companies',headers=hb);check('list scoped to own tenant',len(r.json())==1 and r.json()[0]['id']==b['company_id'])
    name='reviewer-'+suffix
    r=c.post('/api/v1/auth/users',headers=admin,json={'username':name,'email':name+'@example.test','password':'Qatest-2026','role':'auditor','company_id':a['company_id']})
    check('scoped auditor created',r.status_code==201)
    audit=headers(c,name,'Qatest-2026')
    check('auditor cannot read another tenant',c.get(f"/api/v1/companies/{b['company_id']}",headers=audit).status_code==403)
    check('auditor cannot write assigned tenant',c.post('/api/v1/records',headers=audit,json={'company_id':a['company_id'],'record_no':'forbidden-'+suffix,'period':'2026-11','category':'electricity','scope':'scope2','quantity':1,'unit':'kWh','factor_id':'MEE_ELEC_2022_NAT'}).status_code==403)
    invalid={'company_id':a['company_id'],'record_no':'cross-doc-'+suffix,'period':'2026-11','category':'electricity','scope':'scope2','quantity':1,'unit':'kWh','factor_id':'MEE_ELEC_2022_NAT','document_id':1}
    check('cannot attach another tenant original to own record',c.post('/api/v1/records',headers=ha,json=invalid).status_code==422)
    check('cannot bind quota to another tenant supplier',c.post('/api/v1/supply-chain/quotas',headers=ha,json={'company_id':a['company_id'],'supplier_id':'sup-t1-a','year':2026,'allocated_quota':100,'used_quota':0}).status_code==422)
    check('cannot bind reduction plan to another tenant supplier',c.post(f"/api/v1/supply-chain/{a['company_id']}/reduction-plans",headers=ha,json={'plan_id':'cross-plan-'+suffix,'company_id':a['company_id'],'title':'Invalid target','target_supplier_id':'sup-t1-a'}).status_code==422)
    check('tenant cannot enumerate global jobs',c.get('/api/v1/system/jobs',headers=ha).status_code==403)
    jobs=c.get('/api/v1/system/jobs',headers=admin).json()
    if jobs:check('tenant cannot read another tenant job',c.get('/api/v1/system/jobs/'+str(jobs[0]['job_id']),headers=ha).status_code==403)
    check('unimplemented API returns JSON 404',c.get('/api/v1/not-a-route',headers=admin).status_code==404)
    check('lifecycle electricity factor cannot masquerade as Scope2',c.post('/api/v1/calculations/enterprise',headers=admin,json={'company_id':1,'period':'2026-10','factor_set':'official-2024-footprint'}).status_code==400)
    runs=c.get('/api/v1/calculations',headers=admin).json()
    run=next(r for r in runs if r['operation']=='enterprise' and r['company_id']==1)
    r=c.post('/api/v1/reports/iso14064',headers=ha,json={'company_id':a['company_id'],'run_id':run['run_id']})
    check('report cannot relabel another tenant calculation',r.status_code==404)
    r=c.post('/api/v1/simulator/run',headers=ha,json={'company_id':a['company_id'],'scenario_name':'Invalid baseline','electricity_saving_rate':0.1,'procurement_reduction_rate':0,'baseline_run_id':run['run_id']})
    check('scenario cannot read another tenant baseline',r.status_code==404)
    r=c.post('/api/v1/supply-chain/suppliers',headers=audit,json={'supplier_id':'forbidden-'+suffix,'name':'Forbidden supplier'})
    check('auditor cannot bypass write guard via omitted company',r.status_code==403)
    trace=c.get('/api/v1/audit/run/'+run['run_id']+'/trace',headers=admin).json()
    check('new calculation has frozen factor provenance',bool(trace['factors']) and all(f.get('snapshot_available') for f in trace['factors']))
    r=c.post('/api/v1/factors/derive-from-io',headers=admin)
    derived=r.json().get('derived',[])
    check('real CEADs intensity derives exactly 3 purchasing factors',r.status_code==200 and len(derived)==3)
    factors=c.get('/api/v1/factors',headers=admin).json()
    f=[f for f in factors if f['factor_id'].startswith('CEADS_EEIO_')]
    check('derived factors do not overwrite scope1/2',all(x['scope']=='scope3' and x['unit']=='kgCO2/CNY' and x['version'].startswith('research-') for x in f))
    rr=c.post('/api/v1/audit/run/'+run['run_id']+'/attest',headers=admin).json()
    check('hash evidence verified by recomputation',rr['verified'] and rr['external_anchor'] is False)
    with SessionLocal() as db:
        original=db.query(CalculationRun).filter(CalculationRun.run_id==run['run_id']).one()
        old=original.result;original.result={**old,'tampered':True};db.commit()
    check('tampering invalidates hash evidence',c.get('/api/v1/audit/run/'+run['run_id']+'/attestation',headers=admin).json()['verified'] is False)
    with SessionLocal() as db:
        original=db.query(CalculationRun).filter(CalculationRun.run_id==run['run_id']).one();original.result=old;db.commit()
    hs=headers(c,'supplier','supplier123')
    body={'period':'2026-07','reported_emissions':100}
    check('supplier report accepted',c.post('/api/v1/supplier-portal/report',headers=hs,json=body).status_code==201)
    check('supplier report duplicate rejected',c.post('/api/v1/supplier-portal/report',headers=hs,json=body).status_code==409)
    check('supplier negative report rejected',c.post('/api/v1/supplier-portal/report',headers=hs,json={'period':'2026-06','reported_emissions':-1}).status_code==422)
    check('supplier cannot list all business records',c.get('/api/v1/records',headers=hs).status_code==403)
    trade=c.post('/api/v1/supply-chain/trades',headers=ha,json={'seller_company_id':a['company_id'],'buyer_company_id':b['company_id'],'year':2026,'amount':100,'price':1})
    check('quota proposal accepted',trade.status_code==201)
    check('cannot oversell unallocated quota',c.post('/api/v1/supply-chain/trades/'+trade.json()['trade_id']+'/accept',headers=hb,json={}).status_code==409)
for v in [float('nan'),float('inf'),-1]:
    try:_number(v,'input')
    except CalculationError:check('non-finite/negative numerical input rejected '+str(v),True)
    else:raise AssertionError('Invalid numeric input accepted')
check('adjacent BIO entities retained',aggregate_entities(['B-QUESTION','B-ANSWER','B-QUESTION','B-ANSWER'])==[('QUESTION',[0]),('ANSWER',[1]),('QUESTION',[2]),('ANSWER',[3])])
class FakeTokenizer:
    def __call__(self,text,**kwargs):return {'input_ids':list(text[0])}
check('long document windows cover all words',list(word_windows(FakeTokenizer(),['abc']*4,limit=6))==[(0,2),(2,4)])
u=analyze([{'name':'a','emissions_kgco2e':100,'uncertainty_pct':10},{'name':'b','emissions_kgco2e':100,'uncertainty_pct':10}])
check('variance contributions sum to one',abs(sum(x['contribution_to_variance'] for x in u['items'])-1)<1e-6)
check('CNY converted into 10000CNY consistently',sum(run_eiolca_42({'electronic_components':10000})['y_wan'])==1)
check('validated CEADs vector length',len(load_g())==42)
from app.services.gnn import compute_heatmap
unknown=compute_heatmap([{'id':'missing','carbon_intensity':None}],[])['nodes'][0]
check('missing supply-chain data is not fabricated as zero/low risk',unknown['propagated_intensity'] is None and unknown['risk_level']=='unknown')
zero=compute_heatmap([{'id':'zero','carbon_intensity':0}],[])['nodes'][0]
check('reported zero intensity remains valid observed zero',zero['propagated_intensity']==0 and zero['estimated'] is False)
print(json.dumps({'passed':len(passed),'failed':0,'checks':passed},ensure_ascii=False),flush=True)
