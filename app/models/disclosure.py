"""Versioned supplier disclosures and approval metadata."""
from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint

from ..database import Base
from .base import TimestampMixin


class DisclosureCampaign(Base, TimestampMixin):
    __tablename__ = "disclosure_campaigns"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    period = Column(String(7), nullable=False)
    due_on = Column(Date, nullable=False)
    instructions = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class DisclosureRequest(Base, TimestampMixin):
    __tablename__ = "disclosure_requests"
    __table_args__ = (
        UniqueConstraint("tenant_id", "supplier_id", "period"),
        CheckConstraint("status IN ('requested', 'submitted', 'returned', 'approved')"),
    )
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("disclosure_campaigns.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    period = Column(String(7), nullable=False)
    status = Column(String(16), nullable=False, default="requested")


class SupplierEmissionData(Base, TimestampMixin):
    __tablename__ = "supplier_emission_data"
    __table_args__ = (
        UniqueConstraint("request_id", "version_no"),
        CheckConstraint("emissions_kgco2e >= 0 AND (intensity IS NULL OR intensity >= 0)"),
        CheckConstraint("state IN ('submitted', 'returned', 'approved')"),
    )
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("disclosure_requests.id"), nullable=False)
    version_no = Column(Integer, nullable=False)
    emissions_kgco2e = Column(Numeric(25, 6), nullable=False)
    intensity = Column(Numeric(24, 10), nullable=True)
    boundary = Column(Text, nullable=False)
    note = Column(Text, nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    state = Column(String(16), nullable=False, default="submitted")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    published_id = Column(Integer, ForeignKey("supplier_submissions.id"), nullable=True)
