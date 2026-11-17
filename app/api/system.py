"""系统运维路由：AI 引擎状态、异步任务查询。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles, ROLE_ADMIN, ROLE_AUDITOR
from ..models import Job, User
from ..services.ai import layout as layout_ai
from ..services.ai import sbert as sbert_ai
from ..services.ai import ser as ser_ai
from ..services.ai import llm as llm_ai
from ..config import settings

router = APIRouter(prefix="/system", tags=["系统运维"])


@router.get("/ai-status")
def ai_status(_: User = Depends(get_current_user)):
    """AI 引擎就绪状态（轻量检查，不触发模型加载）。"""
    return {
        "ocr": {
            "configured_engine": settings.OCR_ENGINE,
            "model": "PP-OCRv4 (RapidOCR)",
            "status": "ready",
        },
        "layoutlmv3": {
            "model": settings.LAYOUT_MODEL,
            "provisioned": layout_ai.model_cached(),
            "loaded": layout_ai.is_loaded(),
        },
        "ser": {
            "model": settings.SER_MODEL,
            "provisioned": ser_ai.model_cached(),
            "loaded": ser_ai.is_loaded(),
            "error": ser_ai.ser_load_error(),
        },
        "sbert": {
            "model": settings.SBERT_MODEL,
            "provisioned": sbert_ai.model_cached(),
            "loaded": sbert_ai.is_loaded(),
        },
        "llm": {
            "enabled": settings.llm_enabled,
            "model": settings.LLM_MODEL,
            "note": "未配置 LLM_API_BASE/LLM_API_KEY 时 POMDP 使用内置勾稽规则引擎",
        },
    }


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    j = db.get(Job, job_id)
    if not j:
        return {"job_id": job_id, "found": False}
    return {
        "job_id": j.id, "job_type": j.job_type, "status": j.status,
        "result": j.result, "error": j.error, "attempts": j.attempts,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "finished_at": j.finished_at.isoformat() if j.finished_at else None,
    }


@router.get("/jobs")
def list_jobs(db: Session = Depends(get_db),
              _: User = Depends(require_roles(ROLE_ADMIN, ROLE_AUDITOR))):
    jobs = db.query(Job).order_by(Job.id.desc()).limit(100).all()
    return [
        {"job_id": j.id, "job_type": j.job_type, "status": j.status, "error": j.error,
         "created_at": j.created_at.isoformat() if j.created_at else None}
        for j in jobs
    ]
