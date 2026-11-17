"""核心实体：用户、企业、排放因子。"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text

from ..database import Base
from .base import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="enterprise")  # admin/enterprise/supplier/auditor
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    supplier_id = Column(String(64), nullable=True)  # 供应商门户账号绑定的供应商编号
    is_active = Column(Boolean, nullable=False, default=True)


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    industry = Column(String(128), nullable=False, default="电子信息制造")
    region = Column(String(128), nullable=True)
    scale = Column(String(64), nullable=True)
    contact_name = Column(String(128), nullable=True)
    contact_phone = Column(String(64), nullable=True)
    contact_email = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)


class EmissionFactor(Base, TimestampMixin):
    __tablename__ = "emission_factors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    factor_id = Column(String(64), unique=True, nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    scope = Column(String(16), nullable=False, default="scope3")
    value = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    version = Column(String(64), nullable=False)
    origin = Column(String(255), nullable=True)
    price_basis = Column(String(64), nullable=True)
    is_demo = Column(Boolean, nullable=False, default=True)
    uncertainty_pct = Column(Float, nullable=True)  # 不确定性 ±%（ISO 14064/14067 数据质量）
    description = Column(Text, nullable=True)
