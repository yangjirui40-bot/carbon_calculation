"""Start this project's isolated local Docker deployment without resetting data."""
from pathlib import Path
import subprocess,sys,time,urllib.request
root=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(root/'scripts/init_local_env.py')],check=True)
command=['docker','compose','--project-directory',str(root),'--env-file',str(root/'.env.local'),'-f',str(root/'compose.local.yml')]
subprocess.run(command+['up','-d'],check=True)
for attempt in range(90):
 try:
  with urllib.request.urlopen('http://127.0.0.1:18083/healthz',timeout=5) as response:
   if response.status==200:
    print('Ready: http://127.0.0.1:18083 ; login: local private account file.');break
 except Exception:
  if attempt==89:raise SystemExit('Not ready. Check: docker compose --env-file .env.local -f compose.local.yml logs --tail 100 backend')
  time.sleep(2)
