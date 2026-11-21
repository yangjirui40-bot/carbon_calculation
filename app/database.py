"""数据库引擎与会话管理（SQLAlchemy 2.x，同步，默认 PostgreSQL）。"""
from __future__ import annotations

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import settings
from .tenant_security import ROLE, set_context

connect_args: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=8,         # 每进程受控连接池，留出后台任务和运维连接
    max_overflow=8,
    pool_timeout=10,
    connect_args=connect_args,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

Base = declarative_base()


class RequestSession(Session):
    """HTTP 会话。建库、后台工作进程和备份使用独立的维护会话类型。"""


RequestSessionLocal = sessionmaker(
    bind=engine, class_=RequestSession, autoflush=False, future=True,
)


@event.listens_for(RequestSession, "after_begin")
def set_database_request_context(session, transaction, connection):
    if settings.DB_TENANT_ISOLATION_ENABLED and not transaction.nested:
        connection.execute(text(f"SET LOCAL ROLE {ROLE}"))
        set_context(connection, *session.info.get("tenant_context", ()))


def authorize_tenant(db, tenant_id, access):
    if isinstance(db, RequestSession) and settings.DB_TENANT_ISOLATION_ENABLED:
        db.info["tenant_context"] = (tenant_id, access)
        set_context(db.connection(), tenant_id, access)


def get_db():
    """FastAPI 依赖：每个请求一个会话，用完即关闭。"""
    db = RequestSessionLocal()
    try:
        yield db
    finally:
        db.close()
