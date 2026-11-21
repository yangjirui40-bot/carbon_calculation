"""Real multi-page PDF, protected originals and review idempotency regression."""
import os,sys,io,uuid,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
if not os.environ.get('DATABASE_URL','').rsplit('/',1)[-1].startswith('carbonspeed_test'):
 raise SystemExit('Isolated test database required')
from fastapi.testclient import TestClient
from reportlab.pdfgen.canvas import Canvas
from PIL import Image
from app.main import app
from app.database import SessionLocal
from app.models import BusinessRecord,SourceDocument
from app.services.document_media import document_pages,preview_png
from app.services.ai import ocr
from unittest.mock import patch
checks=[]
def check(name,value):
 assert value,name
 checks.append(name);print('[OK]',name,flush=True)
def make_pdf(pages):
 b=io.BytesIO();c=Canvas(b,pagesize=(600,400))
 for _ in range(pages):
  c.drawImage(str(Path(__file__).parent/'fixtures/invoice_demo.png'),0,0,width=600,height=400)
  c.showPage()
 c.save();return b.getvalue()
pdf=make_pdf(2)
images=document_pages(pdf);check('all PDF pages rendered',len(images)==2)
for im in images:im.close()
with Image.open(io.BytesIO(preview_png(pdf))) as im:
 check('preview has consistent stacked coordinates',im.width==1200 and im.height==1600)
with TestClient(app) as c:
 r=c.post('/api/v1/auth/login',data={'username':'admin','password':'admin123'});h={'Authorization':'Bearer '+r.json()['access_token']}
 company=c.post('/api/v1/companies',headers=h,json={'code':'pdf-'+uuid.uuid4().hex[:8],'name':'PDF专项验收企业'}).json()['id']
 r=c.post('/api/v1/documents/upload',headers=h,params={'company_id':company},files={'file':('invoice.pdf',pdf,'application/pdf')})
 check('valid PDF uploaded',r.status_code==201);id=r.json()['id']
 r=c.post(f'/api/v1/documents/{id}/parse',headers=h,params={'wait':True});body=r.json()
 check('PDF parsed by actual OCR',r.status_code==200 and body.get('parse_status')=='parsed' and body.get('ocr_engine','').startswith('RapidOCR'))
 words=body['extracted_fields']['words'];check('page provenance retained',any(x.get('page')==2 for x in words))
 check('raw fields and confidence preserved','raw_fields' in body['extracted_fields'] and 'confidence' in body['extracted_fields'])
 r=c.get(f'/api/v1/documents/{id}/preview',headers=h);check('protected original preview returns PNG',r.status_code==200 and r.content.startswith(b'\x89PNG'))
 check('anonymous cannot retrieve original',c.get(f'/api/v1/documents/{id}/preview').status_code==401)
 name='pdf-other-'+uuid.uuid4().hex[:6]
 c.post('/api/v1/auth/register',json={'username':name,'email':name+'@example.test','password':'Qatest-2026'})
 t=c.post('/api/v1/auth/login',data={'username':name,'password':'Qatest-2026'}).json()['access_token']
 check('another tenant cannot retrieve original',c.get(f'/api/v1/documents/{id}/preview',headers={'Authorization':'Bearer '+t}).status_code in (403,404))
 payload={'review_status':'confirmed','period':'2026-11','category':'electricity','scope':'scope2','factor_id':'MEE_ELEC_2022_NAT','quantity':1200,'unit':'kWh','fields_override':{'total_amount':11300.0},'note':'PDF acceptance test'}
 r=c.post(f'/api/v1/documents/{id}/review',headers=h,json=payload);check('PDF review accepted',r.status_code==201)
 r=c.post(f'/api/v1/documents/{id}/review',headers=h,json=payload);check('repeat confirmation is idempotent',r.status_code==201 and r.json().get('already_confirmed') is True)
 hist=c.get(f'/api/v1/documents/{id}/history',headers=h).json()
 check('parse and review events have linked evidence',len(hist['reviews'])==1 and hist['reviews'][0]['parse_id']==hist['parses'][0]['id'])
 with SessionLocal() as db:check('one invoice creates only one accounting record',db.query(BusinessRecord).filter(BusinessRecord.document_id==id).count()==1)
 duplicate=c.post('/api/v1/documents/upload',headers=h,params={'company_id':company},files={'file':('same-invoice.pdf',pdf,'application/pdf')}).json()['id']
 check('identical file cannot create a second emission record',c.post(f'/api/v1/documents/{duplicate}/review',headers=h,json=payload).status_code==409)
 check('reviewed values retained',c.get(f'/api/v1/documents/{id}',headers=h).json()['extracted_fields']['fields']['total_amount']==11300)
 r=c.post('/api/v1/documents/upload',headers=h,params={'company_id':1},files={'file':('fake.png',b'<html>fake invoice</html>','image/png')});check('invalid media rejected',r.status_code==422)
 r=c.post('/api/v1/documents/upload',headers=h,params={'company_id':1},files={'file':('too-many.pdf',make_pdf(11),'application/pdf')});check('oversized page count rejected',r.status_code==422)
old=ocr._engine
original_import=__import__
def broken_import(name,*args,**kwargs):
 if name=='rapidocr_onnxruntime':raise ImportError('forced test outage')
 return original_import(name,*args,**kwargs)
try:
 ocr._engine=None
 with patch('builtins.__import__',side_effect=broken_import):
  try:ocr._load_engine()
  except RuntimeError:check('OCR outage never fabricates demonstration data',True)
  else:raise AssertionError('Unexpected synthetic OCR fallback')
finally:ocr._engine=old
from app.services.report_files import iso14064_pdf,pcf_pdf
for language in ('zh','en','de','fr'):
 content={'company':{'name':'Company <img src=\"https://example.invalid/x\"/>','industry':'Test'},'scope_breakdown':{},'items':[],'product':{'product_name':'Sample','product_id':'sample'},'language':language}
 for name,renderer in [('inventory',iso14064_pdf),('product',pcf_pdf)]:
  result=renderer(content,language)
  check(f'{language} {name} PDF rendered without interpreting title markup',result.startswith(b'%PDF'))
print(json.dumps({'passed':len(checks),'failed':0,'checks':checks},ensure_ascii=False),flush=True)
