"""企业月度盘查的岗位、期间和决策记录。"""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from ..database import Base
from .base import TimestampMixin, utcnow


class InventoryAssignment(Base, TimestampMixin):
    __tablename__ = "inventory_assignments"
    __table_args__ = (
        CheckConstraint("duty IN ('coordinator', 'reviewer')", name="ck_inventory_assignment_duty"),
    )

    company_id = Column(Integer, ForeignKey("companies.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    duty = Column(String(16), nullable=False)


class InventoryPeriod(Base, TimestampMixin):
    __tablename__ = "inventory_periods"
    __table_args__ = (
        UniqueConstraint("company_id", "period", name="uq_inventory_company_period"),
        CheckConstraint("status IN ('open', 'submitted', 'closed')", name="ck_inventory_period_status"),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    period = Column(String(7), nullable=False)
    boundary = Column(Text, nullable=False)
    status = Column(String(16), nullable=False, default="open")
    revision = Column(Integer, nullable=False, default=1)
    run_id = Column(String(64), ForeignKey("calculation_runs.run_id"))
    submitted_by = Column(Integer, ForeignKey("users.id"))


class InventoryEvent(Base):
    __tablename__ = "inventory_period_events"

    id = Column(Integer, primary_key=True)
    period_id = Column(Integer, ForeignKey("inventory_periods.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(16), nullable=False)
    revision = Column(Integer, nullable=False)
    run_id = Column(String(64), ForeignKey("calculation_runs.run_id"))
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
