"""订阅计费：套餐与租户订阅。"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String

from ..database import Base
from .base import TimestampMixin, utcnow


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_code = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(64), nullable=False)
    price_yearly = Column(Integer, nullable=False, default=0)  # 元/年
    quota_calculations = Column(Integer, nullable=False, default=1000)  # 核算次数/年
    quota_documents = Column(Integer, nullable=False, default=10000)  # 单据数量/年
    features = Column(JSON, nullable=True)


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False, index=True)
    plan_code = Column(String(32), ForeignKey("plans.plan_code"), nullable=False)
    status = Column(String(16), nullable=False, default="active")  # active/expired/trial
    start_date = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    usage_calculations = Column(Integer, nullable=False, default=0)
    usage_documents = Column(Integer, nullable=False, default=0)


def default_end_date() -> datetime:
    return datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year + 1)
