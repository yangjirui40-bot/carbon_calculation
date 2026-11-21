"""Create an isolated local profile once. Never print keys or reset databases."""
from pathlib import Path
import os,secrets,string
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'.env.local'
if p.exists():
 print('Local private environment already exists; preserved.')
 raise SystemExit(0)
source={}
if (ROOT/'.env').exists():
 for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);source[k.strip()]=v.strip().strip('"').strip("'")
password=''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(12))
values={'LOCAL_POSTGRES_PASSWORD':secrets.token_hex(24),'POSTGRES_IMAGE':'adc-clinic-postgres:20261111','SECRET_KEY':secrets.token_hex(32),'DATA_ENC_KEY':secrets.token_hex(32),'FIRST_ADMIN_USERNAME':'admin','FIRST_ADMIN_PASSWORD':password,'FIRST_ADMIN_EMAIL':'local-admin@example.test','DOCS_ENABLED':'true','DEMO_DATA_ENABLED':'true','CORS_ORIGINS':'http://127.0.0.1:18083','LAYOUT_MODEL':'','SER_ENABLED':'false','SBERT_MODEL':'BAAI/bge-small-zh-v1.5','MODELS_CACHE_DIR':'/app/models_cache','RATE_LIMIT_BACKEND':'redis','LLM_API_BASE':source.get('LLM_API_BASE','https://api.deepseek.com'),'LLM_API_KEY':source.get('LLM_API_KEY',''),'LLM_MODEL':'deepseek-flash','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','HF_HUB_OFFLINE':'1'}
p.write_text(''.join(k+'='+v+'\n' for k,v in values.items()),encoding='utf-8');os.chmod(p,0o600)
account=ROOT/'本机账号_勿公开.txt'
account.write_text('本机平台：http://127.0.0.1:18083\n管理员：admin\n密码：'+password+'\n仅用于本机；公网账号请看单独的私密交付文件。\n',encoding='utf-8');os.chmod(account,0o600)
print('Local environment and owner login file created; secret values omitted.')
