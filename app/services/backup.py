"""PostgreSQL 备份/恢复脚本。

用法：
  python -m app.services.backup                # 全量备份（pg_dump）
  python -m app.services.backup --restore <file>   # 恢复（psql）

pg_dump 优先使用本机命令；未安装时通过 Docker 容器执行（BACKUP_PG_CONTAINER 配置容器名，
默认 carbonspeed-db，即 WSL Docker 中的数据库容器）。
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "vendor"))

from app.config import BASE_DIR, settings  # noqa: E402

BACKUP_DIR = BASE_DIR / "backups"
PG_CONTAINER = getattr(settings, "BACKUP_PG_CONTAINER", "carbonspeed-db") or "carbonspeed-db"


def _parse_url(url: str) -> dict:
    from urllib.parse import urlparse, unquote

    p = urlparse(url.replace("postgresql+psycopg2://", "postgresql://"))
    return {
        "host": p.hostname or "localhost",
        "port": p.port or 5432,
        "user": unquote(p.username or "postgres"),
        "password": unquote(p.password or ""),
        "db": (p.path or "/postgres").lstrip("/"),
    }


def _run_local(cmd: list[str]) -> bytes:
    return subprocess.check_output(cmd, stderr=subprocess.STDOUT)


def _run_docker(cmd: list[str]) -> bytes:
    """容器内执行命令：优先本机 docker CLI；未安装时通过 WSL 调用（wsl -u root -e docker）。"""
    full = ["docker", "exec", "-e", "PGPASSWORD=" + _parse_url(settings.DATABASE_URL)["password"],
            PG_CONTAINER] + cmd
    try:
        return subprocess.check_output(full, stderr=subprocess.STDOUT)
    except FileNotFoundError:
        return subprocess.check_output(["wsl", "-u", "root", "-e"] + full, stderr=subprocess.STDOUT)


def backup() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    cfg = _parse_url(settings.DATABASE_URL)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = BACKUP_DIR / f"carbonspeed_{stamp}.sql"
    if shutil.which("pg_dump"):
        args = ["pg_dump", "-h", cfg["host"], "-p", str(cfg["port"]), "-U", cfg["user"],
                "-d", cfg["db"], "--no-owner", "--no-privileges"]
        data = _run_local(args)
    else:
        # 容器内执行：使用容器内本地连接（无需 host/port）
        args = ["pg_dump", "-U", cfg["user"], "-d", cfg["db"], "--no-owner", "--no-privileges"]
        data = _run_docker(args)
    out.write_bytes(data)
    print(f"[OK] 备份完成：{out}（{len(data) // 1024} KB）")
    return out


def restore(path: str) -> None:
    cfg = _parse_url(settings.DATABASE_URL)
    sql = Path(path)
    if not sql.exists():
        raise SystemExit(f"备份文件不存在：{path}")
    args = ["psql", "-h", cfg["host"], "-p", str(cfg["port"]), "-U", cfg["user"], "-d", cfg["db"], "-f", "/tmp/restore.sql"]
    if shutil.which("psql"):
        subprocess.run(["psql", "-h", cfg["host"], "-p", str(cfg["port"]), "-U", cfg["user"],
                        "-d", cfg["db"], "-f", str(sql)], check=True)
        print("[OK] 恢复完成")
        return
    # 通过 docker 恢复：把文件拷入容器再执行（无本机 docker CLI 时走 wsl）
    def _cp(src: str, dst: str) -> None:
        try:
            subprocess.check_call(["docker", "cp", src, dst])
        except FileNotFoundError:
            subprocess.check_call(["wsl", "-u", "root", "-e", "docker", "cp", src, dst])

    _cp(str(sql), f"{PG_CONTAINER}:/tmp/restore.sql")
    _run_docker(["psql", "-U", cfg["user"], "-d", cfg["db"], "-f", "/tmp/restore.sql"])
    print("[OK] 恢复完成")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--restore", default=None)
    args = parser.parse_args()
    if args.restore:
        restore(args.restore)
    else:
        backup()
