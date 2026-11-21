"""Versioned operational details. Ownership is enforced through each parent."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint

from ..database import Base
from .base import utcnow


class ScenarioMeasure(Base):
    __tablename__ = "scenario_measures"
    calculation_run_id = Column(Integer, ForeignKey("calculation_runs.id", ondelete="CASCADE"), primary_key=True)
    measure_code = Column(String(48), primary_key=True)
    amount_or_ratio = Column(Numeric(20, 12), nullable=False)


class ScenarioProjection(Base):
    __tablename__ = "scenario_projections"
    calculation_run_id = Column(Integer, ForeignKey("calculation_runs.id", ondelete="CASCADE"), primary_key=True)
    period = Column(String(7), primary_key=True)
    scope = Column(Integer, primary_key=True, default=0)  # 0: combined; 1–3: per scope
    bau_kgco2e = Column(Numeric(24, 6), nullable=False)
    intervention_kgco2e = Column(Numeric(24, 6), nullable=False)


class ScenarioCashflow(Base):
    __tablename__ = "scenario_cashflows"
    calculation_run_id = Column(Integer, ForeignKey("calculation_runs.id", ondelete="CASCADE"), primary_key=True)
    project_year = Column(Integer, primary_key=True)
    flow_type = Column(String(28), primary_key=True)
    amount = Column(Numeric(26, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="CNY")


class DocumentParseRun(Base):
    __tablename__ = "document_parse_runs"
    __table_args__ = (UniqueConstraint("job_id", "attempt"),)
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"))
    attempt = Column(Integer, nullable=False)
    state = Column(String(16), nullable=False)
    engine = Column(String(64))
    started_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at = Column(DateTime(timezone=True))


class DocumentReview(Base):
    __tablename__ = "document_reviews"
    __table_args__ = (UniqueConstraint("document_id", "version_no"),)
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False)
    parse_run_id = Column(Integer, ForeignKey("document_parse_runs.id", ondelete="SET NULL"))
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    version_no = Column(Integer, nullable=False)
    decision = Column(String(16), nullable=False)
    overrides = Column(JSON)
    decided_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class InvoiceVerification(Base):
    __tablename__ = "invoice_verifications"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    state = Column(String(16), nullable=False)
    detail = Column(Text, nullable=True)
    checked_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
