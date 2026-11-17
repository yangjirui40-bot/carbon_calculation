"""数据库任务队列：异步解析等长任务的后台执行。

采用"DB 为队列 + 进程内 worker 线程"的模式：无需外部消息中间件，
任务可重试、可查询、崩溃可恢复；多副本部署时借助 PostgreSQL 行锁
（FOR UPDATE SKIP LOCKED）避免重复消费。若需更大规模，可替换为 Celery/Redis。
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text  # noqa: F401

from .config import settings
from .database import SessionLocal
from .models import Job

_HANDLERS: dict[str, object] = {}
_worker: threading.Thread | None = None
_stop = threading.Event()
POLL_INTERVAL = 1.0

# Redis 唤醒通道（可选）：提交任务时 publish，worker 订阅以降低轮询延迟
_REDIS = None


def _redis_client():
    global _REDIS
    if _REDIS is not None:
        return _REDIS
    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, decode_responses=True)
        client.ping()
        _REDIS = client
    except Exception:  # noqa: BLE001
        _REDIS = False
    return _REDIS


def _wait_wake(timeout: float) -> bool:
    """等待唤醒：Redis 可用时订阅任务通道，否则休眠轮询。"""
    client = _redis_client()
    if not client:
        _stop.wait(timeout)
        return False
    try:
        pubsub = client.pubsub()
        pubsub.subscribe("carbonspeed:jobs")
        msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout)
        pubsub.close()
        return msg is not None
    except Exception:  # noqa: BLE001
        _stop.wait(timeout)
        return False


def register_handler(job_type: str, fn):
    _HANDLERS[job_type] = fn


def submit_job(job_type: str, payload: dict | None = None) -> Job:
    db = SessionLocal()
    try:
        job = Job(job_type=job_type, payload=payload, status="pending")
        db.add(job)
        db.commit()
        db.refresh(job)
        try:
            client = _redis_client()
            if client:
                client.publish("carbonspeed:jobs", str(job.id))
        except Exception:  # noqa: BLE001
            pass
        return job
    finally:
        db.close()


def _claim_next() -> Job | None:
    db = SessionLocal()
    try:
        if db.bind.dialect.name == "postgresql":
            job = (
                db.query(Job)
                .filter(Job.status == "pending")
                .order_by(Job.id)
                .with_for_update(skip_locked=True)
                .first()
            )
        else:
            job = db.query(Job).filter(Job.status == "pending").order_by(Job.id).first()
        if job is None:
            return None
        job.status = "running"
        job.attempts += 1
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)
        return job
    finally:
        db.close()


def _finish(job_id: int, status: str, result=None, error=None) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job:
            job.status = status
            job.result = result
            job.error = error
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def _worker_loop() -> None:
    while not _stop.is_set():
        try:
            job = _claim_next()
            if job is None:
                _wait_wake(POLL_INTERVAL)
                continue
            handler = _HANDLERS.get(job.job_type)
            if handler is None:
                _finish(job.id, "failed", error=f"未注册的任务类型：{job.job_type}")
                continue
            try:
                result = handler(job.payload or {})
                _finish(job.id, "success", result=result)
            except Exception as exc:  # noqa: BLE001
                if job.attempts >= job.max_attempts:
                    _finish(job.id, "failed", error=f"{type(exc).__name__}: {exc}")
                else:
                    db = SessionLocal()
                    try:
                        j = db.get(Job, job.id)
                        if j:
                            j.status = "pending"
                            j.error = f"{type(exc).__name__}: {exc}"
                            db.commit()
                    finally:
                        db.close()
        except Exception:  # noqa: BLE001
            _wait_wake(POLL_INTERVAL)


def start_worker() -> None:
    global _worker
    if _worker is None or not _worker.is_alive():
        _stop.clear()
        _worker = threading.Thread(target=_worker_loop, name="job-worker", daemon=True)
        _worker.start()


def stop_worker() -> None:
    _stop.set()


__all__ = ["Job", "register_handler", "submit_job", "start_worker", "stop_worker"]
