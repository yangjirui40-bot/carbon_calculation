"""Immutable BOM versions and documented production allocations."""
from sqlalchemy import Column, Date, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint

from ..database import Base
from .base import TimestampMixin


class BomVersion(Base, TimestampMixin):
    __tablename__ = "bom_versions"
    __table_args__ = (UniqueConstraint("product_id", "version_no"),)
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    version_no = Column(Integer, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    digest = Column(String(64), nullable=False)
    content = Column(JSON, nullable=False)


class ProductStudy(Base, TimestampMixin):
    __tablename__ = "pcf_studies"
    id = Column(Integer, primary_key=True)
    bom_version_id = Column(Integer, ForeignKey("bom_versions.id"), unique=True, nullable=False)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    start_on = Column(Date, nullable=False)
    end_on = Column(Date, nullable=False)
    boundary_note = Column(Text, nullable=False)


class PcfAllocation(Base):
    __tablename__ = "pcf_allocations"
    __table_args__ = (UniqueConstraint("study_id", "record_no"),)
    id = Column(Integer, primary_key=True)
    study_id = Column(Integer, ForeignKey("pcf_studies.id"), nullable=False)
    inventory_run_id = Column(String(64), ForeignKey("calculation_runs.run_id"), nullable=False)
    record_no = Column(String(64), nullable=False)
    share_ratio = Column(Numeric(10, 8), nullable=False)
    emissions_kgco2e = Column(Numeric(24, 6), nullable=False)
    reason = Column(Text, nullable=False)
    item_snapshot = Column(JSON, nullable=False)
