"""OLAP 星型模型（分析层）：维度表 + 事实表，与 OLTP 3NF 业务层分离。

星型建模：
- 维度表：dim_company / dim_period / dim_category / dim_supplier（代理键 + 属性）
- 事实表：fact_emission（明细事实，粒度=业务记录）
         fact_company_emission（汇总事实，粒度=企业×期间，供驾驶舱高速聚合）
ETL：services/olap.py refresh_olap()，由种子/记录变更/手工触发。
"""
from __future__ import annotations

from sqlalchemy import Column, Float, ForeignKey, Integer, String, Boolean

from ..database import Base


class DimCompany(Base):
    __tablename__ = "dim_company"

    company_key = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, unique=True, nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    industry = Column(String(128), nullable=True)
    region = Column(String(128), nullable=True)


class DimPeriod(Base):
    __tablename__ = "dim_period"

    period_key = Column(Integer, primary_key=True, autoincrement=True)
    period = Column(String(16), unique=True, nullable=False, index=True)  # 2026-10
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)


class DimCategory(Base):
    __tablename__ = "dim_category"

    category_key = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(64), unique=True, nullable=False, index=True)
    scope = Column(String(16), nullable=False)


class DimSupplier(Base):
    __tablename__ = "dim_supplier"

    supplier_key = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    industry = Column(String(128), nullable=True)
    region = Column(String(128), nullable=True)
    tier = Column(Integer, nullable=True)


class FactEmission(Base):
    __tablename__ = "fact_emission"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_key = Column(Integer, ForeignKey("dim_company.company_key"), nullable=False, index=True)
    period_key = Column(Integer, ForeignKey("dim_period.period_key"), nullable=False, index=True)
    category_key = Column(Integer, ForeignKey("dim_category.category_key"), nullable=False, index=True)
    supplier_key = Column(Integer, ForeignKey("dim_supplier.supplier_key"), nullable=True)
    record_no = Column(String(64), nullable=False)
    activity_qty = Column(Float, nullable=True)  # kWh / L
    amount_cny = Column(Float, nullable=True)  # 采购金额
    emissions_kgco2e = Column(Float, nullable=False)
    factor_id = Column(String(64), nullable=False)
    factor_version = Column(String(64), nullable=True)
    is_demo = Column(Boolean, nullable=False, default=True)


class FactCompanyEmission(Base):
    __tablename__ = "fact_company_emission"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_key = Column(Integer, ForeignKey("dim_company.company_key"), nullable=False, index=True)
    period_key = Column(Integer, ForeignKey("dim_period.period_key"), nullable=False, index=True)
    scope1 = Column(Float, nullable=False, default=0)
    scope2 = Column(Float, nullable=False, default=0)
    scope3 = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    record_count = Column(Integer, nullable=False, default=0)
