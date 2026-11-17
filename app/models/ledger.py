"""账本实体：核算任务、减排情景、审计日志、区块链存证与报告。"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text

from ..database import Base
from .base import TimestampMixin, utcnow


class CalculationRun(Base):
    """核算任务：持久化输入快照、因子版本、算法版本与结果。"""

    __tablename__ = "calculation_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True)
    operation = Column(String(32), nullable=False, index=True)  # enterprise/eiolca/product/scenario
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    product_id = Column(String(64), nullable=True)
    request_snapshot = Column(JSON, nullable=False)
    factor_versions = Column(JSON, nullable=True)
    algorithm_version = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False, default="success", index=True)
    result = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Scenario(Base, TimestampMixin):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String(64), unique=True, nullable=False, index=True)
    scenario_name = Column(String(255), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    baseline_run_id = Column(String(64), ForeignKey("calculation_runs.run_id"), nullable=True)
    electricity_saving_rate = Column(Float, nullable=False, default=0)
    procurement_reduction_rate = Column(Float, nullable=False, default=0)
    baseline_total_kgco2e = Column(Float, nullable=True)
    scenario_total_kgco2e = Column(Float, nullable=True)
    reduction_kgco2e = Column(Float, nullable=True)
    reduction_rate = Column(Float, nullable=True)
    result = Column(JSON, nullable=True)
    roi = Column(JSON, nullable=True)  # ROI/NPV/回收期测算结果


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=True, index=True)
    action = Column(String(64), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    source_ip = Column(String(64), nullable=True)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class BlockchainAttestation(Base):
    """区块链哈希存证：对核算结果生成 SHA-256 哈希并链式上链（模拟区块高度）。"""

    __tablename__ = "blockchain_attestations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True)
    attestation_hash = Column(String(64), nullable=False)
    prev_hash = Column(String(64), nullable=True)
    data_summary = Column(JSON, nullable=True)
    block_height = Column(Integer, nullable=False, default=1)
    onchain_time = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_no = Column(String(64), unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    report_type = Column(String(32), nullable=False, default="ISO14064")  # ISO14064/PCF/audit/supply_chain
    run_id = Column(String(64), nullable=True)
    title = Column(String(255), nullable=False)
    language = Column(String(8), nullable=False, default="zh")
    status = Column(String(16), nullable=False, default="generated")
    content = Column(JSON, nullable=True)


class Job(Base, TimestampMixin):
    """异步任务（数据库队列）：文档解析等长任务。"""

    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(64), nullable=False, index=True)
    status = Column(String(16), nullable=False, default="pending", index=True)  # pending/running/success/failed
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
