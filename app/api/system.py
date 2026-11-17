"""系统运维路由：AI 引擎状态、异步任务查询。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin, require_roles, ROLE_ADMIN, ROLE_AUDITOR
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


@router.post("/olap/refresh")
def olap_refresh(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """重建 OLAP 星型模型（维度 upsert + 事实表全量刷新）。"""
    from ..services.olap import refresh_olap

    return refresh_olap(db)


@router.get("/schema")
def schema_info(_: User = Depends(get_current_user)):
    """数据建模说明：OLTP 业务层 3NF + OLAP 分析层星型建模。"""
    from ..database import Base
    from sqlalchemy import inspect as sa_inspect
    from ..database import engine

    insp = sa_inspect(engine)
    oltp = [t for t in sorted(insp.get_table_names())
            if not t.startswith(("dim_", "fact_", "alembic"))]
    olap_tables = [t for t in sorted(insp.get_table_names())
                   if t.startswith(("dim_", "fact_"))]
    return {
        "modeling": {
            "OLTP": {
                "范式": "第三范式（3NF）：每表单一事实来源、非主属性完全依赖主键且无传递依赖；"
                        "企业与业务实体通过外键引用（companies/emission_factors 为维度，"
                        "business_records/calculation_runs 为事务）；JSON 列仅用于加密快照与审计留痕。",
                "表数": len(oltp),
                "表": oltp,
            },
            "OLAP": {
                "建模": "星型建模（Star Schema）：事实表处于中心，外键指向维度表（代理键），"
                        "驾驶舱聚合查询全部走事实表，实现读写分离与多维聚合。",
                "维度表": [t for t in olap_tables if t.startswith("dim_")],
                "事实表": [t for t in olap_tables if t.startswith("fact_")],
                "ETL": "POST /api/v1/system/olap/refresh（种子/记录变更自动触发）",
            },
        }
    }
