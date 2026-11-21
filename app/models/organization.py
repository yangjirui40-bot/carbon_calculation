"""Controlled tenant onboarding and versioned reporting boundaries."""
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from .base import TimestampMixin


class TenantMember(Base, TimestampMixin):
    __tablename__ = "tenant_members"
    __table_args__ = (UniqueConstraint("tenant_id", "account_id"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_owner = Column(Boolean, nullable=False, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class TenantInvite(Base, TimestampMixin):
    __tablename__ = "tenant_invites"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    token_digest = Column(String(64), unique=True, nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class LegalEntity(Base, TimestampMixin):
    __tablename__ = "legal_entities"
    __table_args__ = (UniqueConstraint("tenant_id", "id"), UniqueConstraint("tenant_id", "code"))
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    code = Column(String(32), nullable=False)
    legal_name = Column(String(160), nullable=False)
    jurisdiction = Column(String(80), nullable=False)
    registration_no = Column(String(64), nullable=True)


class Site(Base, TimestampMixin):
    __tablename__ = "sites"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "code"),
        ForeignKeyConstraint(("tenant_id", "legal_entity_id"), ("legal_entities.tenant_id", "legal_entities.id")),
    )
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    legal_entity_id = Column(Integer, nullable=False)
    code = Column(String(32), nullable=False)
    name = Column(String(100), nullable=False)
    region = Column(String(80), nullable=False)


class OrgUnit(Base, TimestampMixin):
    __tablename__ = "org_units"
    __table_args__ = (
        UniqueConstraint("tenant_id", "site_id", "id"),
        UniqueConstraint("tenant_id", "site_id", "code"),
        ForeignKeyConstraint(("tenant_id", "site_id"), ("sites.tenant_id", "sites.id")),
        ForeignKeyConstraint(("tenant_id", "site_id", "parent_id"), ("org_units.tenant_id", "org_units.site_id", "org_units.id")),
        CheckConstraint("kind IN ('workshop', 'line', 'department')"),
    )
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    site_id = Column(Integer, nullable=False)
    parent_id = Column(Integer, nullable=True)
    code = Column(String(32), nullable=False)
    name = Column(String(80), nullable=False)
    kind = Column(String(16), nullable=False)


class ReportingBoundary(Base, TimestampMixin):
    __tablename__ = "reporting_boundaries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "code", "version_no"),
        CheckConstraint("consolidation IN ('operational_control', 'financial_control', 'equity_share')"),
    )
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    code = Column(String(32), nullable=False)
    version_no = Column(Integer, nullable=False)
    title = Column(String(120), nullable=False)
    consolidation = Column(String(24), nullable=False)
    note = Column(Text, nullable=False)
    published_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class BoundaryMember(Base):
    __tablename__ = "boundary_members"
    __table_args__ = (
        ForeignKeyConstraint(("tenant_id", "boundary_id"), ("reporting_boundaries.tenant_id", "reporting_boundaries.id")),
        ForeignKeyConstraint(("tenant_id", "site_id"), ("sites.tenant_id", "sites.id")),
        CheckConstraint("share_ratio > 0 AND share_ratio <= 1"),
    )
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    boundary_id = Column(Integer, primary_key=True)
    site_id = Column(Integer, primary_key=True)
    share_ratio = Column(Numeric(10, 8), nullable=False)


class ReportingPeriod(Base):
    """Add a structured boundary to an existing monthly close without rewriting history."""

    __tablename__ = "reporting_periods"
    __table_args__ = (
        ForeignKeyConstraint(("tenant_id", "boundary_id"), ("reporting_boundaries.tenant_id", "reporting_boundaries.id")),
    )
    inventory_id = Column(Integer, ForeignKey("inventory_periods.id"), primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    boundary_id = Column(Integer, nullable=False)


class ActivityLocation(Base):
    __tablename__ = "activity_locations"
    __table_args__ = (
        ForeignKeyConstraint(("tenant_id", "site_id"), ("sites.tenant_id", "sites.id")),
        ForeignKeyConstraint(("tenant_id", "site_id", "org_unit_id"), ("org_units.tenant_id", "org_units.site_id", "org_units.id")),
    )
    record_id = Column(Integer, ForeignKey("business_records.id", ondelete="CASCADE"), primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    site_id = Column(Integer, nullable=False)
    org_unit_id = Column(Integer, nullable=True)
    site = relationship(Site, lazy="joined", viewonly=True, foreign_keys=[tenant_id, site_id])


class ScopeAssessment(Base, TimestampMixin):
    __tablename__ = "scope_assessments"
    __table_args__ = (
        CheckConstraint("category BETWEEN 1 AND 15"),
        CheckConstraint("status IN ('included', 'unavailable', 'not_applicable', 'excluded')"),
    )
    inventory_id = Column(Integer, ForeignKey("reporting_periods.inventory_id"), primary_key=True)
    category = Column(Integer, primary_key=True)
    status = Column(String(16), nullable=False)
    rationale = Column(Text, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class ActivityRevision(Base, TimestampMixin):
    __tablename__ = "activity_revisions"
    __table_args__ = (UniqueConstraint("record_id", "revision_no"),)
    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("business_records.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    revision_no = Column(Integer, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    snapshot = Column(JSON, nullable=False)
