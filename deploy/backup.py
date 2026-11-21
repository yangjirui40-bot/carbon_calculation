"""Private, carbon-only PostgreSQL and upload backup. Run on its Linux host."""
from pathlib import Path
import datetime,hashlib,json,os,subprocess,tarfile
ROOT=Path('/opt/carbonspeed')
BACKUPS=ROOT/'backups';BACKUPS.mkdir(mode=0o700,exist_ok=True);os.chmod(BACKUPS,0o700)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
out=BACKUPS/stamp;out.mkdir(mode=0o700)
compose=['docker','compose','--project-directory',str(ROOT),'-f',str(ROOT/'compose.yml')]
with (out/'database.dump').open('wb') as f:
 subprocess.run(compose+['exec','-T','db','pg_dump','-U','carbonspeed','-d','carbonspeed','-Fc'],stdout=f,check=True)
mount=json.loads(subprocess.check_output(['docker','volume','inspect','carbon-platform_storage']))[0]['Mountpoint']
with tarfile.open(out/'uploads.tar.gz','w:gz') as t:t.add(mount,arcname='storage')
for name in ('.env','compose.yml'):
 target=out/name;target.write_bytes((ROOT/name).read_bytes());os.chmod(target,0o600)
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.iterdir() if p.is_file()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
for p in out.iterdir():os.chmod(p,0o600)
print(json.dumps({'backup_directory':str(out),'files':list(manifest)},ensure_ascii=False))
