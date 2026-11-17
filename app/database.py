"""数据库引擎与会话管理（SQLAlchemy 2.x，同步，默认 PostgreSQL）。"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

connect_args: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,        # 支持 20 并发线程（端点会话 + 审计中间件会话）
    max_overflow=30,
    pool_timeout=10,
    connect_args=connect_args,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

Base = declarative_base()


def get_db():
    """FastAPI 依赖：每个请求一个会话，用完即关闭。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
