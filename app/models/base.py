"""通用模型基类与时间戳混入。"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    """统一 created_at / updated_at 字段。"""

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
