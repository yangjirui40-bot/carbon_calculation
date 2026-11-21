"""Company-supplied sources and immutable factor versions."""
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from ..database import Base
from .base import TimestampMixin


class FactorSource(Base, TimestampMixin):
    __tablename__ = "factor_sources"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    publisher = Column(String(120), nullable=False)
    citation = Column(Text, nullable=False)
    methodology = Column(Text, nullable=False)
    gas_coverage = Column(String(80), nullable=False)


class CompanyFactorVersion(Base, TimestampMixin):
    __tablename__ = "factor_versions"
    __table_args__ = (UniqueConstraint("tenant_id", "series", "version_no"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    emission_factor_id = Column(Integer, ForeignKey("emission_factors.id"), unique=True, nullable=False)
    source_id = Column(Integer, ForeignKey("factor_sources.id"), nullable=False)
    series = Column(String(24), nullable=False)
    version_no = Column(Integer, nullable=False)
    valid_from = Column(String(7), nullable=False)
    valid_to = Column(String(7), nullable=True)
    published_by = Column(Integer, ForeignKey("users.id"), nullable=False)
