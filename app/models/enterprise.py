"""核算组织维度、BOM 层级和年度排放预算。"""
from sqlalchemy import CheckConstraint, Column, Float, ForeignKey, Integer, String

from ..database import Base


class RecordDimensions(Base):
    __tablename__ = "record_dimensions"

    record_id = Column(Integer, ForeignKey("business_records.id", ondelete="CASCADE"), primary_key=True)
    workshop = Column(String(80))
    production_line = Column(String(80))
    scope3_category = Column(Integer)
    __table_args__ = (
        CheckConstraint("production_line IS NULL OR workshop IS NOT NULL"),
        CheckConstraint("scope3_category BETWEEN 1 AND 15"),
    )


class BomAssembly(Base):
    __tablename__ = "bom_assemblies"

    bom_id = Column(Integer, ForeignKey("bom_items.id", ondelete="CASCADE"), primary_key=True)
    assembly_path = Column(String(240), nullable=False)


class EmissionBudget(Base):
    __tablename__ = "emission_budgets"

    company_id = Column(Integer, ForeignKey("companies.id"), primary_key=True)
    year = Column(Integer, primary_key=True)
    annual_limit_kgco2e = Column(Float, nullable=False)
    __table_args__ = (CheckConstraint("annual_limit_kgco2e > 0"),)
