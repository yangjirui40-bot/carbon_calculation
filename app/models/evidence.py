"""Normalized run lineage and report artifacts owned through their parent rows."""
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Float, ForeignKey, ForeignKeyConstraint
from sqlalchemy import Integer, JSON, LargeBinary, String, Text

from ..database import Base
from .base import utcnow


class CalculationInput(Base):
    __tablename__ = "calculation_inputs"

    calculation_run_id = Column(Integer, ForeignKey("calculation_runs.id", ondelete="CASCADE"), primary_key=True)
    line_no = Column(Integer, primary_key=True)
    source_kind = Column(String(24), nullable=False)
    source_ref = Column(Text, nullable=False)
    period = Column(Text)
    document_id = Column(Integer)
    snapshot = Column(JSON, nullable=False)


class EmissionResultLine(Base):
    __tablename__ = "emission_result_lines"
    __table_args__ = (
        ForeignKeyConstraint(
            ("calculation_run_id", "input_line_no"),
            ("calculation_inputs.calculation_run_id", "calculation_inputs.line_no"),
        ),
        CheckConstraint("emissions_kgco2e >= 0"),
    )

    calculation_run_id = Column(Integer, ForeignKey("calculation_runs.id", ondelete="CASCADE"), primary_key=True)
    line_no = Column(Integer, primary_key=True)
    input_line_no = Column(Integer)
    phase = Column(String(24), nullable=False)
    scope = Column(String(12))
    category = Column(Text)
    factor_id = Column(Text)
    factor_version = Column(Text)
    emissions_kgco2e = Column(Float, nullable=False)
    is_demo = Column(Boolean)


class ReportArtifact(Base):
    __tablename__ = "report_artifacts"
    __table_args__ = (CheckConstraint("format IN ('pdf', 'xml')"), CheckConstraint("size_bytes > 0"))

    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True)
    format = Column(String(4), primary_key=True)
    sha256 = Column(String(64), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    content = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
