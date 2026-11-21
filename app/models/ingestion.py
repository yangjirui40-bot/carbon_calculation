"""Tenant-scoped credentials and idempotent ingestion receipts."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from ..database import Base
from .base import TimestampMixin


class DataConnection(Base, TimestampMixin):
    __tablename__ = "data_connections"
    __table_args__ = (UniqueConstraint("tenant_id","code"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    code = Column(String(16), nullable=False)
    name = Column(String(100), nullable=False)
    token_digest = Column(String(64), unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class IngestBatch(Base, TimestampMixin):
    __tablename__ = "ingest_batches"
    __table_args__ = (UniqueConstraint("connection_id","request_key"),)
    id = Column(Integer, primary_key=True)
    connection_id = Column(Integer, ForeignKey("data_connections.id"), nullable=False, index=True)
    request_key = Column(String(72), nullable=False)
    payload_hash = Column(String(64), nullable=False)
    rows = Column(Integer, nullable=False)
    imported = Column(Integer, nullable=False)
    skipped = Column(Integer, nullable=False)
