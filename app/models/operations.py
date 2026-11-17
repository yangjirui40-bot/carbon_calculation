"""业务实体：业务记录、原始凭证、产品与 BOM。"""
from __future__ import annotations

from sqlalchemy import Column, Float, ForeignKey, Integer, JSON, String, Text

from ..database import Base
from .base import TimestampMixin


class BusinessRecord(Base, TimestampMixin):
    """参与碳核算的业务记录（Scope 1 活动量 / Scope 2 电量 / Scope 3 采购金额）。"""

    __tablename__ = "business_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_no = Column(String(64), unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period = Column(String(16), nullable=False, index=True)  # 如 2026-10
    category = Column(String(64), nullable=False, index=True)
    scope = Column(String(16), nullable=False, index=True)
    quantity = Column(Float, nullable=True)  # Scope1(L)/Scope2(kWh)
    unit = Column(String(16), nullable=True)
    amount = Column(Float, nullable=True)  # Scope3(CNY)
    currency = Column(String(8), nullable=False, default="CNY")
    factor_id = Column(String(64), ForeignKey("emission_factors.factor_id"), nullable=False)
    review_status = Column(String(16), nullable=False, default="pending", index=True)
    source = Column(String(32), nullable=False, default="manual")  # manual/excel/api/photo
    document_id = Column(Integer, ForeignKey("source_documents.id"), nullable=True)
    remark = Column(Text, nullable=True)


class SourceDocument(Base, TimestampMixin):
    """原始单据/凭证：来自拍照、Excel 导入或 ERP API。"""

    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    doc_type = Column(String(32), nullable=False, default="invoice")  # invoice/electricity_bill/purchase_order/receipt
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=True)
    file_ext = Column(String(16), nullable=True)
    parse_status = Column(String(16), nullable=False, default="uploaded")  # uploaded/parsing/parsed/failed
    raw_text = Column(Text, nullable=True)
    extracted_fields = Column(JSON, nullable=True)  # 结构化的识别结果（AES-256-GCM 加密）
    overall_confidence = Column(Float, nullable=True)
    ocr_engine = Column(String(64), nullable=False, default="LayoutLMv3")
    correction_log = Column(JSON, nullable=True)  # POMDP-LLM 纠偏步骤
    review_status = Column(String(16), nullable=False, default="pending")
    verified_status = Column(String(16), nullable=False, default="unverified")  # verified/failed/unverified
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_note = Column(String(512), nullable=True)
    content_hash = Column(String(64), nullable=True, index=True)  # 文件 SHA-256，用于重复单据拦截


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(64), unique=True, nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    output_quantity = Column(Float, nullable=False, default=0)
    product_unit = Column(String(32), nullable=False, default="件")
    description = Column(Text, nullable=True)


class BOMItem(Base, TimestampMixin):
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    bom_item_id = Column(String(64), nullable=False, index=True)
    material_name = Column(String(255), nullable=False)
    material_amount = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="CNY")
    matched_category = Column(String(64), nullable=True)
    matched_factor_id = Column(String(64), ForeignKey("emission_factors.factor_id"), nullable=True)
    match_confidence = Column(Float, nullable=True)  # SBERT 语义对齐置信度
