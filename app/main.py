"""FastAPI 应用入口。"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, SessionLocal, engine

# 导入所有模型，确保建表时已注册到 Base.metadata
from . import models as _models  # noqa: F401
from .api import (
    audit,
    auth,
    billing,
    calculations,
    companies,
    dashboard,
    documents,
    factors,
    products,
    records,
    reports,
    simulator,
    supplier_portal,
    supply_chain,
    system,
)
from .jobs import start_worker, stop_worker
from .rate_limit import limiter
from .security import decode_access_token
from .metrics import HTTP_LATENCY, HTTP_REQUESTS, metrics_response, path_group

WEB_DIR = Path(__file__).resolve().parent / "web"
# 前端构建产物：优先同仓库 backend/frontend/dist（GitHub/Docker 布局），
# 兼容旧布局（frontend 为 backend 的兄弟目录）。
_candidates = [
    Path(__file__).resolve().parents[1] / "frontend" / "dist",
    Path(__file__).resolve().parents[2] / "frontend" / "dist",
]
FRONTEND_DIST = next((p for p in _candidates if (p / "index.html").exists()), _candidates[0])
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_worker()
    yield
    stop_worker()


app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    """全量操作审计：记录所有写操作（方法/路径/操作人/状态码）。"""
    response = await call_next(request)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith(settings.API_PREFIX):
        from .models import AuditLog

        user_id = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                payload = decode_access_token(auth.split(" ", 1)[1])
                user_id = int(payload.get("sub"))
            except Exception:  # noqa: BLE001
                user_id = None
        db = SessionLocal()
        try:
            db.add(AuditLog(
                action=f"{request.method} {request.url.path}",
                actor_user_id=user_id,
                source_ip=request.client.host if request.client else None,
                detail={"status_code": response.status_code},
            ))
            db.commit()
        finally:
            db.close()
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """按客户端 IP 限流（进程内/Redis，多副本一致）。"""
    path = request.url.path
    if path in ("/", "/healthz", "/metrics") or path.startswith(("/docs", "/openapi.json", "/redoc")):
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    if not limiter.allow(ip):
        return JSONResponse(status_code=429, content={"detail": "请求过于频繁，请稍后再试"})
    return await call_next(request)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Prometheus 指标：请求计数与耗时直方图（P50/P95/P99 可观测）。"""
    import time

    start = time.perf_counter()
    response = await call_next(request)
    group = path_group(request.url.path)
    HTTP_REQUESTS.labels(request.method, group, str(response.status_code)).inc()
    HTTP_LATENCY.labels(request.method, group).observe(time.perf_counter() - start)
    return response


prefix = settings.API_PREFIX
for router in (
    auth.router,
    companies.router,
    factors.router,
    documents.router,
    records.router,
    calculations.router,
    products.router,
    dashboard.router,
    audit.router,
    simulator.router,
    supply_chain.router,
    reports.router,
    billing.router,
    system.router,
    supplier_portal.router,
):
    app.include_router(router, prefix=prefix)


@app.get("/metrics", include_in_schema=False, tags=["系统运维"])
def metrics():
    """Prometheus 指标导出（P95 线可观测）。"""
    return Response(content=metrics_response(), media_type="text/plain; version=0.0.4")


@app.get("/", include_in_schema=False)
def index():
    """前端单页应用（优先 frontend/dist 构建产物，回退内置管理页）。"""
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX)
    index_file = WEB_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "ok"}


@app.get("/healthz", tags=["健康检查"])
def healthz():
    return {"status": "healthy", "algorithm_version": settings.ALGORITHM_VERSION}


# ---------------------------------------------------------------------------
# 前端静态托管（单源部署）：frontend/dist 存在时，/assets 与其余静态资源、
# 前端路由（如 /login、/dashboard）全部由后端同源提供，SPA 回退到 index.html。
# 所有 /api/v1、/docs、/metrics、/healthz 路由均在前面注册，优先级高于回退。
# ---------------------------------------------------------------------------
if FRONTEND_INDEX.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        dist_root = FRONTEND_DIST.resolve()
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(dist_root):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_INDEX)
