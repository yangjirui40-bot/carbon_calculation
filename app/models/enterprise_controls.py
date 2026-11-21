"""Operational controls for electricity, internal quotas, service usage and reporting."""
from sqlalchemy import (CheckConstraint, Column, Boolean, Date, DateTime, ForeignKey, Integer, Numeric,
                        String, Text, JSON, UniqueConstraint)
from ..database import Base
from .base import utcnow


class EnergyCertificate(Base):
    __tablename__ = "energy_certificates"
    __table_args__ = (UniqueConstraint("issuer_key", "serial_key"), CheckConstraint("credited_kwh > 0"))
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    proof_id = Column(Integer, ForeignKey("source_documents.id"), nullable=False)
    issuer = Column(String(128), nullable=False)
    serial = Column(String(128), nullable=False)
    issuer_key = Column(String(160), nullable=False)
    serial_key = Column(String(160), nullable=False)
    period_from = Column(String(7), nullable=False)
    period_to = Column(String(7), nullable=False)
    retirement_reference = Column(String(200), nullable=False)
    credited_kwh = Column(Numeric(20, 4), nullable=False)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class CertificateAllocation(Base):
    __tablename__ = "certificate_allocations"
    __table_args__ = (CheckConstraint("applied_kwh > 0"), UniqueConstraint("company_id", "request_key"))
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    certificate_id = Column(Integer, ForeignKey("energy_certificates.id"), nullable=False, index=True)
    record_id = Column(Integer, ForeignKey("business_records.id"), nullable=False, index=True)
    revision_id = Column(Integer, ForeignKey("activity_revisions.id"), nullable=False)
    request_key = Column(String(80), nullable=False)
    applied_kwh = Column(Numeric(20, 4), nullable=False)
    allocated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    allocated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    cancelled_at = Column(DateTime(timezone=True))
    cancelled_by = Column(Integer, ForeignKey("users.id"))
    cancellation_reason = Column(String(300))


class QuotaEntry(Base):
    __tablename__ = "quota_entries"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    quota_id = Column(Integer, ForeignKey("carbon_quotas.id"), nullable=False, index=True)
    kind = Column(String(24), nullable=False)
    reference = Column(String(128))
    allocated_delta = Column(Numeric, nullable=False)
    used_delta = Column(Numeric, nullable=False)
    allocated_after = Column(Numeric, nullable=False)
    used_after = Column(Numeric, nullable=False)
    posted_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class ReductionProgressEvent(Base):
    __tablename__ = "reduction_progress_events"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("reduction_plans.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    previous_progress = Column(Numeric, nullable=False)
    progress = Column(Numeric, nullable=False)
    note = Column(String(400))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class UsageEvent(Base):
    __tablename__ = "usage_events"
    id = Column(Integer, primary_key=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    usage_type = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class WarehouseRefresh(Base):
    __tablename__ = "warehouse_refreshes"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    activities = Column(Integer, nullable=False)
    periods = Column(Integer, nullable=False)
    refreshed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class RawObject(Base):
    __tablename__ = "raw_objects"
    document_id = Column(Integer, ForeignKey("source_documents.id"), primary_key=True)
    sha256 = Column(String(64), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class DocumentPage(Base):
    __tablename__ = "document_pages"
    document_id = Column(Integer, ForeignKey("source_documents.id"), primary_key=True)
    page_number = Column(Integer, primary_key=True)
    width_px = Column(Integer, nullable=False)
    height_px = Column(Integer, nullable=False)


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    parse_id = Column(Integer, ForeignKey("document_parse_runs.id"), primary_key=True)
    field_name = Column(String(128), primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    protected_values = Column(JSON, nullable=False)
    method = Column(String(128))
    confidence = Column(Numeric(10, 8))


class PeriodWork:
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("inventory_periods.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opened_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(160), nullable=False)
    due_date = Column(Date, nullable=False)
    state = Column(String(16), nullable=False, default="open")
    version = Column(Integer, nullable=False, default=1)
    resolution = Column(String(500))
    evidence_id = Column(Integer, ForeignKey("source_documents.id"))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))


class PeriodResponsibility(PeriodWork, Base):
    __tablename__ = "period_responsibilities"


class QualityIssue(PeriodWork, Base):
    __tablename__ = "quality_issues"
    severity = Column(String(16), nullable=False)


class IoDatasetVersion(Base):
    __tablename__ = "io_dataset_versions"
    id = Column(Integer, primary_key=True)
    digest = Column(String(64), unique=True, nullable=False)
    price_year = Column(Integer, nullable=False)
    source_metadata = Column(JSON, nullable=False)
    matrix = Column(JSON, nullable=False)
    domestic_adjusted = Column(Boolean, nullable=False)
    added_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class IoSector(Base):
    __tablename__ = "io_sectors"
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("io_dataset_versions.id"), nullable=False)
    position = Column(Integer, nullable=False)
    name = Column(String(128), nullable=False)
    __table_args__ = (UniqueConstraint("dataset_id","position"), UniqueConstraint("dataset_id","name"))


class IoIntensity(Base):
    __tablename__ = "io_intensities"
    sector_id = Column(Integer, ForeignKey("io_sectors.id"), primary_key=True)
    kg_co2_per_wan = Column(Numeric(24, 12), nullable=False)
    __table_args__ = (CheckConstraint("kg_co2_per_wan >= 0"),)


class IoSectorMap(Base):
    __tablename__ = "io_sector_maps"
    dataset_id = Column(Integer, ForeignKey("io_dataset_versions.id"), primary_key=True)
    category = Column(String(64), primary_key=True)
    sector_id = Column(Integer, ForeignKey("io_sectors.id"), nullable=False)


class IoDerivationRun(Base):
    __tablename__ = "io_derivation_runs"
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("io_dataset_versions.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    result = Column(JSON, nullable=False)
    derived_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class FactorSet(Base):
    __tablename__ = "factor_sets"
    code = Column(String(64), primary_key=True)
    purpose = Column(String(32), nullable=False)


class FactorSetEntry(Base):
    __tablename__ = "factor_set_entries"
    set_code = Column(String(64), ForeignKey("factor_sets.code"), primary_key=True)
    category = Column(String(64), primary_key=True)
    factor_id = Column(String(64), ForeignKey("emission_factors.factor_id"), nullable=False)
