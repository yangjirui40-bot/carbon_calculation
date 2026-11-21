"""Enterprise domain entities specified by the approved carbon-accounting ERD."""
from sqlalchemy import (BigInteger, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey,
                        ForeignKeyConstraint, Integer, JSON, Numeric, String, Text, UniqueConstraint)
from ..database import Base


class Tenant(Base):
    """企业账套。"""
    __tablename__ = "tenants"
    id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    code = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("code"),
    )


class Account(Base):
    """身份账号。"""
    __tablename__ = "accounts"
    id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    login = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    status = Column(String(255), nullable=False)
    identity_provider = Column(String(255), nullable=False)
    subject = Column(String(255))
    auth_ref = Column(String(255))
    __table_args__ = (
        UniqueConstraint("login"),
        UniqueConstraint("email"),
    )


class PlatformRole(Base):
    """权限角色。"""
    __tablename__ = "platform_roles"
    id = Column(Integer, primary_key=True)
    code = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    capability_keys = Column(JSON, nullable=False)
    __table_args__ = (
        UniqueConstraint("code"),
    )


class RoleGrant(Base):
    """角色授权。"""
    __tablename__ = "role_grants"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("tenant_members.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("platform_roles.id"), nullable=False)
    legal_entity_id = Column(Integer, ForeignKey("legal_entities.id"))
    site_id = Column(Integer, ForeignKey("sites.id"))
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("valid_to IS NULL OR valid_to >= valid_from"),
    )


class MeteringPoint(Base):
    """计量点。"""
    __tablename__ = "metering_points"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    meter_code = Column(String(255), nullable=False)
    medium = Column(String(255), nullable=False)
    default_unit_id = Column(Integer, ForeignKey("measurement_units.id"), nullable=False)
    installed_on = Column(Date, nullable=False)
    retired_on = Column(Date)
    __table_args__ = (
        UniqueConstraint("tenant_id", "site_id", "meter_code"),
        CheckConstraint("retired_on IS NULL OR retired_on >= installed_on"),
    )


class StagedActivity(Base):
    """待归集活动。"""
    __tablename__ = "staged_activities"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("ingest_batches.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("source_documents.id"))
    source_record_key = Column(String(255), nullable=False)
    line_no = Column(Integer, nullable=False)
    payload = Column(JSON, nullable=False)
    state = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("batch_id", "line_no"),
    )


class ImportRejection(Base):
    """导入行异常。"""
    __tablename__ = "import_rejections"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("ingest_batches.id"), nullable=False)
    kv_row = Column(String(255), nullable=False)
    field_name = Column(String(255))
    reason_code = Column(String(255), nullable=False)
    detail = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)


class ModelRelease(Base):
    """模型或规则版本。"""
    __tablename__ = "model_releases"
    id = Column(Integer, primary_key=True)
    model_code = Column(String(255), nullable=False)
    version = Column(String(255), nullable=False)
    provider = Column(String(255), nullable=False)
    artifact_uri = Column(String(255))
    artifact_hash = Column(String(255))
    engine_type = Column(String(255), nullable=False)
    status = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("model_code", "version"),
    )


class ModelTrainingRun(Base):
    """模型训练运行。"""
    __tablename__ = "model_training_runs"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    base_model_id = Column(Integer, ForeignKey("model_releases.id"), nullable=False)
    train_set_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    validation_set_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    output_model_id = Column(Integer, ForeignKey("model_releases.id"))
    trainer_revision = Column(String(255), nullable=False)
    params = Column(JSON, nullable=False)
    checkpoint_hash = Column(String(255))
    status = Column(String(255), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    train_split_hash = Column(String(64))
    validation_split_hash = Column(String(64))
    __table_args__ = (
        UniqueConstraint("tenant_id", "checkpoint_hash"),
    )


class ModelEvaluation(Base):
    """模型评估记录。"""
    __tablename__ = "model_evaluations"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    training_run_id = Column(Integer, ForeignKey("model_training_runs.id"))
    model_release_id = Column(Integer, ForeignKey("model_releases.id"), nullable=False)
    dataset_object_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    evaluated_at = Column(DateTime(timezone=True), nullable=False)
    training_performed = Column(Boolean, nullable=False)
    data_split_hash = Column(String(255), nullable=False)
    metrics = Column(JSON, nullable=False)
    scope_note = Column(Text, nullable=False)


class MeasurementUnit(Base):
    """计量单位字典。"""
    __tablename__ = "measurement_units"
    id = Column(Integer, primary_key=True)
    ucum_code = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    dimension = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("ucum_code"),
    )


class UnitConversion(Base):
    """单位换算规则。"""
    __tablename__ = "unit_conversions"
    id = Column(Integer, primary_key=True)
    from_unit_id = Column(Integer, ForeignKey("measurement_units.id"), nullable=False)
    to_unit_id = Column(Integer, ForeignKey("measurement_units.id"), nullable=False)
    multiplier = Column(Numeric(27, 10), nullable=False)
    valid_start = Column(Date, nullable=False)
    valid_end = Column(Date)
    source_ref = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("from_unit_id", "to_unit_id", "valid_start"),
        CheckConstraint("multiplier > 0"),
        CheckConstraint("from_unit_id <> to_unit_id"),
    )


class ActivityCategory(Base):
    """排放活动分类。"""
    __tablename__ = "activity_categories"
    id = Column(Integer, primary_key=True)
    category_code = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("activity_categories.id"))
    name = Column(String(255), nullable=False)
    scope = Column(Integer, nullable=False)
    scope3_category = Column(Integer)
    allowed_bases = Column(JSON, nullable=False)
    __table_args__ = (
        UniqueConstraint("category_code"),
    )


class ActivityRecord(Base):
    """活动业务主键。"""
    __tablename__ = "activity_records"
    id = Column(Integer, ForeignKey("business_records.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    record_no = Column(String(255), nullable=False)
    period_id = Column(Integer, ForeignKey("reporting_periods.inventory_id"))
    staged_id = Column(Integer, ForeignKey("staged_activities.id"))
    site_id = Column(Integer, ForeignKey("sites.id"))
    category_id = Column(Integer, ForeignKey("activity_categories.id"))
    external_key = Column(String(255))
    period_label = Column(String(7), nullable=False)
    __table_args__ = (
        UniqueConstraint("tenant_id", "record_no"),
    )


class ActivityEvidence(Base):
    """活动证据关联。"""
    __tablename__ = "activity_evidence"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    activity_revision_id = Column(Integer, ForeignKey("activity_revisions.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("source_documents.id"))
    raw_object_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    evidence_role = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("activity_revision_id", "document_id", "evidence_role"),
    )


class FactorGasComponent(Base):
    """分气体排放系数。"""
    __tablename__ = "factor_gas_components"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    factor_version_id = Column(Integer, ForeignKey("factor_versions.id"), nullable=False)
    gas_code = Column(String(255), nullable=False)
    gwp_set_id = Column(Integer, ForeignKey("gwp_sets.id"))
    kg_per_base_unit = Column(Numeric(27, 10), nullable=False)
    uncertainty_pct = Column(Numeric(27, 10))
    __table_args__ = (
        UniqueConstraint("factor_version_id", "gas_code"),
    )


class GwpSet(Base):
    """GWP 版本。"""
    __tablename__ = "gwp_sets"
    id = Column(Integer, primary_key=True)
    edition_code = Column(String(255), nullable=False)
    horizon_years = Column(Integer, nullable=False)
    citation = Column(Text, nullable=False)
    released_on = Column(Date, nullable=False)
    __table_args__ = (
        UniqueConstraint("edition_code", "horizon_years"),
    )


class GwpValue(Base):
    """各气体 GWP。"""
    __tablename__ = "gwp_values"
    id = Column(Integer, primary_key=True)
    gwp_set_id = Column(Integer, ForeignKey("gwp_sets.id"), nullable=False)
    gas_code = Column(String(255), nullable=False)
    multiplier = Column(Numeric(27, 10), nullable=False)
    __table_args__ = (
        UniqueConstraint("gwp_set_id", "gas_code"),
        CheckConstraint("multiplier > 0"),
    )


class MethodVersion(Base):
    """核算方法版本。"""
    __tablename__ = "method_versions"
    id = Column(Integer, primary_key=True)
    method_code = Column(String(255), nullable=False)
    version = Column(String(255), nullable=False)
    activity_basis = Column(String(255), nullable=False)
    boundary_kind = Column(String(255), nullable=False)
    source_ref = Column(String(255), nullable=False)
    calculation_contract = Column(JSON, nullable=False)
    __table_args__ = (
        UniqueConstraint("method_code", "version"),
    )


class PriceIndex(Base):
    """价格调整系数。"""
    __tablename__ = "price_indices"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    source_id = Column(Integer, ForeignKey("factor_sources.id"), nullable=False)
    source_year = Column(Integer, nullable=False)
    target_year = Column(Integer, nullable=False)
    region_code = Column(String(255), nullable=False)
    basis = Column(String(255), nullable=False)
    multiplier = Column(Numeric(27, 10), nullable=False)
    __table_args__ = (
        UniqueConstraint("tenant_id", "source_id", "source_year", "target_year", "region_code", "basis"),
        CheckConstraint("multiplier > 0"),
    )


class CloseVersion(Base):
    """期间关账版本。"""
    __tablename__ = "close_versions"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("reporting_periods.inventory_id"))
    run_id = Column(Integer, ForeignKey("calculation_runs.id"), nullable=False)
    revision_no = Column(Integer, nullable=False)
    submitted_by = Column(Integer, ForeignKey("tenant_members.id"))
    submitted_at = Column(DateTime(timezone=True), nullable=False)
    state = Column(String(255), nullable=False)
    inventory_period_id = Column(Integer, ForeignKey("inventory_periods.id"), nullable=False)
    __table_args__ = (
        UniqueConstraint("inventory_period_id", "revision_no"),
    )


class CloseAction(Base):
    """送审与复核动作。"""
    __tablename__ = "close_actions"
    id = Column(Integer, ForeignKey("inventory_period_events.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    close_version_id = Column(Integer, ForeignKey("close_versions.id"))
    actor_id = Column(Integer, ForeignKey("tenant_members.id"))
    action = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    performed_at = Column(DateTime(timezone=True), nullable=False)


class ReportRelease(Base):
    """报告发行版本。"""
    __tablename__ = "report_releases"
    id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    report_no = Column(String(255), nullable=False)
    run_id = Column(Integer, ForeignKey("calculation_runs.id"))
    campaign_id = Column(Integer, ForeignKey("disclosure_campaigns.id"))
    close_version_id = Column(Integer, ForeignKey("close_versions.id"))
    report_kind = Column(String(255), nullable=False)
    issue_no = Column(Integer, nullable=False)
    assurance_state = Column(String(255), nullable=False)
    release_state = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("report_no"),
    )


class EvidenceReceipt(Base):
    """完整性与存证回执。"""
    __tablename__ = "evidence_receipts"
    id = Column(Integer, ForeignKey("blockchain_attestations.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    release_id = Column(Integer, ForeignKey("report_releases.id"))
    run_id = Column(Integer, ForeignKey("calculation_runs.id"))
    method = Column(String(255), nullable=False)
    content_digest = Column(String(255), nullable=False)
    previous_digest = Column(String(255))
    provider_receipt_id = Column(String(255))
    external_state = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)


class AssuranceEngagement(Base):
    """外部核证与受控交付。"""
    __tablename__ = "assurance_engagements"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    release_id = Column(Integer, ForeignKey("report_releases.id"), nullable=False)
    verifier_code = Column(String(255))
    recipient_type = Column(String(255), nullable=False)
    access_grant_id = Column(Integer, ForeignKey("role_grants.id"))
    validity_end = Column(DateTime(timezone=True))
    scope_note = Column(Text, nullable=False)
    result_object_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    state = Column(String(255), nullable=False)
    prepared_finance_id = Column(Integer, ForeignKey("finance_assessments.id",use_alter=True,name="fk_engagement_prepared_finance"))
    recipient_label = Column(String(160), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    revoked_at = Column(DateTime(timezone=True))
    downloaded_at = Column(DateTime(timezone=True))


class FinanceAssessment(Base):
    """绿色金融评估稿。"""
    __tablename__ = "finance_assessments"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    engagement_id = Column(Integer, ForeignKey("assurance_engagements.id"))
    evaluation_profile = Column(String(255), nullable=False)
    scored_at = Column(DateTime(timezone=True))
    score = Column(Numeric(27, 10))
    state = Column(String(255), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("tenant_members.id"))
    release_id = Column(Integer, ForeignKey("report_releases.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class FinanceMetricResult(Base):
    """评估指标与结果。"""
    __tablename__ = "finance_metric_results"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    assessment_id = Column(Integer, ForeignKey("finance_assessments.id"), nullable=False)
    metric_code = Column(String(255), nullable=False)
    measure = Column(Numeric(27, 10))
    weight = Column(Numeric(27, 10))
    score = Column(Numeric(27, 10))
    calculation_run_id = Column(Integer)
    result_line_no = Column(Integer)
    proof_id = Column(Integer, ForeignKey("raw_objects.document_id"))
    unit = Column(String(32), nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(("calculation_run_id", "result_line_no"), ("emission_result_lines.calculation_run_id", "emission_result_lines.line_no")),
        UniqueConstraint("assessment_id", "metric_code"),
    )


class AuditEvent(Base):
    """业务审计事件。"""
    __tablename__ = "audit_events"
    id = Column(Integer, ForeignKey("audit_logs.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("tenant_members.id"))
    run_id = Column(Integer, ForeignKey("calculation_runs.id"))
    event_type = Column(String(255), nullable=False)
    target_ref = Column(String(255), nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    request_id = Column(String(255))
    detail = Column(JSON, nullable=False)


class ProductVersion(Base):
    """产品规格版本。"""
    __tablename__ = "product_versions"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    version_no = Column(Integer, nullable=False)
    declared_unit_id = Column(Integer, ForeignKey("measurement_units.id"))
    stable_spec = Column(JSON, nullable=False)
    valid_from = Column(Date)
    bom_version_id = Column(Integer, ForeignKey("bom_versions.id"), unique=True)
    __table_args__ = (
        UniqueConstraint("product_id", "version_no"),
    )


class BomLine(Base):
    """多级 BOM 明细。"""
    __tablename__ = "bom_lines"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    bom_version_id = Column(Integer, ForeignKey("bom_versions.id"), nullable=False)
    parent_line_id = Column(Integer, ForeignKey("bom_lines.id"))
    item_code = Column(String(255), nullable=False)
    material_name = Column(String(255), nullable=False)
    qty = Column(Numeric(27, 10))
    unit_id = Column(Integer, ForeignKey("measurement_units.id"))
    purchase_value = Column(Numeric(27, 10))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    __table_args__ = (
        UniqueConstraint("bom_version_id", "item_code"),
    )


class PcfInventoryItem(Base):
    """产品生命周期清单项。"""
    __tablename__ = "pcf_inventory_items"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    study_id = Column(Integer, ForeignKey("pcf_studies.id"), nullable=False)
    bom_line_id = Column(Integer, ForeignKey("bom_lines.id"))
    supplier_data_id = Column(Integer, ForeignKey("supplier_emission_data.id"))
    factor_version_id = Column(Integer, ForeignKey("factor_versions.id"))
    stage_code = Column(String(255), nullable=False)
    data_origin = Column(String(255), nullable=False)
    activity_qty = Column(Numeric(27, 10))
    activity_unit_id = Column(Integer, ForeignKey("measurement_units.id"))
    net_amount = Column(Numeric(27, 10))
    currency = Column(String(255))
    __table_args__ = (
        UniqueConstraint("study_id", "bom_line_id"),
    )


class SupplierRelationship(Base):
    """供应链连接边。"""
    __tablename__ = "supplier_relationships"
    id = Column(Integer, ForeignKey("supply_chain_edges.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    buying_entity_id = Column(Integer, ForeignKey("legal_entities.id"))
    downstream_supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    upstream_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    valid_from = Column(Date)
    valid_to = Column(Date)
    relation_type = Column(String(255), nullable=False)
    amount = Column(Numeric(27, 10))


class SupplierAccessGrant(Base):
    """供应商门户授权。"""
    __tablename__ = "supplier_access_grants"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True))
    state = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("supplier_id", "account_id", "valid_from"),
    )


class SupplierRiskAssessment(Base):
    """供应商碳风险快照。"""
    __tablename__ = "supplier_risk_assessments"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("reporting_periods.inventory_id"), nullable=False)
    source_data_id = Column(Integer, ForeignKey("supplier_emission_data.id"))
    estimate_model_id = Column(Integer, ForeignKey("model_releases.id"))
    risk_level = Column(String(255), nullable=False)
    data_origin = Column(String(255), nullable=False)
    intensity = Column(Numeric(27, 10))
    threshold_version = Column(String(255), nullable=False)


class BudgetAllocation(Base):
    """预算分解额度。"""
    __tablename__ = "budget_allocations"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("reporting_periods.inventory_id"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id"))
    scenario_basis = Column(String(255), nullable=False)
    amount_kgco2e = Column(Numeric(27, 10), nullable=False)
    budget_year = Column(Integer, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(("tenant_id", "budget_year"), ("emission_budgets.company_id", "emission_budgets.year")),
        UniqueConstraint("tenant_id", "budget_year", "period_id", "site_id", "scenario_basis"),
        CheckConstraint("amount_kgco2e >= 0"),
    )


class QuotaAccount(Base):
    """内部配额账户。"""
    __tablename__ = "quota_accounts"
    id = Column(Integer, ForeignKey("carbon_quotas.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    account_code = Column(String(255), nullable=False)
    legal_entity_id = Column(Integer, ForeignKey("legal_entities.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    compliance_year = Column(Integer, nullable=False)
    account_status = Column(String(255), nullable=False)
    __table_args__ = (
        UniqueConstraint("tenant_id", "account_code"),
    )


class QuotaExchangeAgreement(Base):
    """企业间转移授权。"""
    __tablename__ = "quota_exchange_agreements"
    id = Column(Integer, primary_key=True)
    from_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    to_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    purpose = Column(String(255), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True))
    status = Column(String(255), nullable=False)
    __table_args__ = (
        CheckConstraint("from_tenant_id <> to_tenant_id"),
    )


class QuotaTransfer(Base):
    """内部配额转移指令。"""
    __tablename__ = "quota_transfers"
    id = Column(Integer, ForeignKey("quota_trades.id", ondelete="CASCADE"), autoincrement=False, primary_key=True)
    from_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    to_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    from_quota_account_id = Column(Integer, ForeignKey("quota_accounts.id"))
    to_quota_account_id = Column(Integer, ForeignKey("quota_accounts.id"))
    agreement_id = Column(Integer, ForeignKey("quota_exchange_agreements.id"))
    quantity_kgco2e = Column(Numeric(27, 10), nullable=False)
    reference_price = Column(Numeric(27, 10))
    currency = Column(String(255))
    created_by = Column(Integer, ForeignKey("tenant_members.id"))
    accepted_by = Column(Integer, ForeignKey("tenant_members.id"))
    state = Column(String(255), nullable=False)
    idempotency_key = Column(String(255))
    __table_args__ = (
        UniqueConstraint("from_tenant_id", "idempotency_key"),
        CheckConstraint("quantity_kgco2e > 0"),
        CheckConstraint("from_tenant_id <> to_tenant_id"),
    )


class NotificationDelivery(Base):
    """提醒与送达记录。"""
    __tablename__ = "notification_deliveries"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    recipient_id = Column(Integer, ForeignKey("tenant_members.id"))
    campaign_request_id = Column(Integer, ForeignKey("disclosure_requests.id"))
    channel = Column(String(255), nullable=False)
    event_kind = Column(String(255), nullable=False)
    state = Column(String(255), nullable=False)
    sent_at = Column(DateTime(timezone=True))
    source_key = Column(String(100), nullable=False)
    message = Column(String(500), nullable=False)
    read_at = Column(DateTime(timezone=True))
    __table_args__ = (
        UniqueConstraint("tenant_id", "recipient_id", "event_kind", "source_key"),
    )


class DimOrg(Base):
    """场地车间产线维度。"""
    __tablename__ = "dim_org"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"))
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    hierarchy_path = Column(String(255), nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date)
    __table_args__ = (
        UniqueConstraint("tenant_id", "site_id", "org_unit_id", "valid_from"),
    )
