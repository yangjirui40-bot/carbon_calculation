"""供应链协同实体：供应商、供应链边、碳配额、减排计划。"""
from __future__ import annotations

from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String

from ..database import Base
from .base import TimestampMixin


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    industry = Column(String(128), nullable=True)  # 国民经济部门 / 行业
    region = Column(String(128), nullable=True)
    tier = Column(Integer, nullable=False, default=1)  # 1/2/3 级供应商
    carbon_intensity = Column(Float, nullable=True)  # kgCO2e/CNY
    annual_emissions = Column(Float, nullable=True)
    risk_level = Column(String(16), nullable=False, default="green")  # green/yellow/red
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)


class SupplyChainEdge(Base, TimestampMixin):
    __tablename__ = "supply_chain_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(64), nullable=False, index=True)
    target_id = Column(String(64), nullable=False, index=True)
    relation_type = Column(String(32), nullable=False, default="purchase")  # purchase/logistics/finance
    amount = Column(Float, nullable=True)
    transport_distance = Column(Float, nullable=True)
    transport_mode = Column(String(32), nullable=True)


class CarbonQuota(Base, TimestampMixin):
    __tablename__ = "carbon_quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    supplier_id = Column(String(64), nullable=True, index=True)
    year = Column(Integer, nullable=False, default=2026)
    allocated_quota = Column(Float, nullable=False, default=0)
    used_quota = Column(Float, nullable=False, default=0)


class ReductionPlan(Base, TimestampMixin):
    __tablename__ = "reduction_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(String(64), unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    target_supplier_id = Column(String(64), nullable=True)
    target_reduction_rate = Column(Float, nullable=False, default=0)
    progress = Column(Float, nullable=False, default=0)
    status = Column(String(16), nullable=False, default="ongoing")  # ongoing/completed/overdue
    deadline = Column(Date, nullable=True)


class SupplierSubmission(Base, TimestampMixin):
    """供应商自主填报的碳数据（供应商门户）。"""

    __tablename__ = "supplier_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(String(64), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period = Column(String(16), nullable=False)
    reported_emissions = Column(Float, nullable=False, default=0)  # 当期排放 kgCO2e
    reported_intensity = Column(Float, nullable=True)  # kgCO2e/CNY
    note = Column(String(512), nullable=True)


class QuotaTrade(Base, TimestampMixin):
    """跨企业碳配额交易。"""

    __tablename__ = "quota_trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_id = Column(String(64), unique=True, nullable=False, index=True)
    seller_company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    buyer_company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, default=2026)
    amount = Column(Float, nullable=False, default=0)  # 配额数量 kgCO2e
    price = Column(Float, nullable=False, default=0)  # 元/kgCO2e
    status = Column(String(16), nullable=False, default="pending")  # pending/accepted/declined
    note = Column(String(512), nullable=True)
