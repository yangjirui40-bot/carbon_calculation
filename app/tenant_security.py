"""PostgreSQL protection for tenant-owned operational and evidence records."""
from sqlalchemy import text

ROLE = "carbon_request"
BILATERAL = ("quota_transfers", "quota_exchange_agreements")
OWNER_COLUMNS = {
    "role_grants": "tenant_id",
    "metering_points": "tenant_id",
    "staged_activities": "tenant_id",
    "import_rejections": "tenant_id",
    "model_training_runs": "tenant_id",
    "model_evaluations": "tenant_id",
    "activity_records": "tenant_id",
    "activity_evidence": "tenant_id",
    "factor_gas_components": "tenant_id",
    "price_indices": "tenant_id",
    "close_versions": "tenant_id",
    "close_actions": "tenant_id",
    "report_releases": "tenant_id",
    "evidence_receipts": "tenant_id",
    "assurance_engagements": "tenant_id",
    "finance_assessments": "tenant_id",
    "finance_metric_results": "tenant_id",
    "audit_events": "tenant_id",
    "product_versions": "tenant_id",
    "bom_lines": "tenant_id",
    "pcf_inventory_items": "tenant_id",
    "supplier_relationships": "tenant_id",
    "supplier_access_grants": "tenant_id",
    "supplier_risk_assessments": "tenant_id",
    "budget_allocations": "tenant_id",
    "quota_accounts": "tenant_id",
    "notification_deliveries": "tenant_id",
    "dim_org": "tenant_id",

    "quality_issues": "company_id",
    "period_responsibilities": "company_id",
    "extracted_fields": "company_id",
    "warehouse_refreshes": "company_id",
    "usage_events": "company_id",
    "quota_entries": "company_id",
    "reduction_progress_events": "company_id",
    "energy_certificates": "company_id",
    "certificate_allocations": "company_id",
    "business_records": "company_id",
    "source_documents": "company_id",
    "calculation_runs": "company_id",
    "reports": "company_id",
    "products": "company_id",
    "scenarios": "company_id",
    "activity_revisions": "tenant_id",
}
CHILDREN = {
    "calculation_inputs": ("calculation_runs", "calculation_run_id"),
    "emission_result_lines": ("calculation_runs", "calculation_run_id"),
    "report_artifacts": ("reports", "report_id"),
    "scenario_measures": ("calculation_runs", "calculation_run_id"),
    "scenario_projections": ("calculation_runs", "calculation_run_id"),
    "scenario_cashflows": ("calculation_runs", "calculation_run_id"),
    "raw_objects": ("source_documents", "document_id"),
    "document_pages": ("source_documents", "document_id"),
    "document_parse_runs": ("source_documents", "document_id"),
    "document_reviews": ("source_documents", "document_id"),
    "invoice_verifications": ("source_documents", "document_id"),
}

_CONTEXT = text("""
    SELECT set_config('carbon.tenant_id', :tenant, true),
           set_config('carbon.access', :access, true)
""")


def set_context(connection, tenant_id=None, access="anonymous"):
    connection.execute(_CONTEXT, {"tenant": str(tenant_id) if tenant_id else "", "access": access})


def install_policies(engine):
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Tenant row security requires PostgreSQL")
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(42160211)"))
        connection.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'carbon_request') THEN
                    CREATE ROLE carbon_request NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
                        NOINHERIT NOREPLICATION NOBYPASSRLS;
                END IF;
            END $$;
        """))
        safe_role = connection.execute(text("""
            SELECT NOT (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR
                        rolcreatedb OR rolreplication OR rolinherit)
            FROM pg_roles WHERE rolname = 'carbon_request'
        """)).scalar_one()
        if not safe_role:
            raise RuntimeError("carbon_request role has unsafe privileges")
        connection.execute(text(f"GRANT USAGE ON SCHEMA public TO {ROLE}"))
        connection.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {ROLE}"))
        connection.execute(text(f"GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO {ROLE}"))
        connection.execute(text(f"REVOKE INSERT, UPDATE, DELETE ON quota_entries FROM {ROLE}"))
        for table in (*CHILDREN, "usage_events", "reduction_progress_events", "warehouse_refreshes", "factor_gas_components", "price_indices"):
            connection.execute(text(f"REVOKE UPDATE, DELETE ON {table} FROM {ROLE}"))
        for table in ("factor_sets", "factor_set_entries", "io_dataset_versions", "io_sectors", "io_intensities", "io_sector_maps"):
            connection.execute(text(f"REVOKE INSERT, UPDATE, DELETE ON {table} FROM {ROLE}"))
        tenant = "NULLIF(current_setting('carbon.tenant_id', true), '')::integer"
        access = "current_setting('carbon.access', true)"
        for table, column in OWNER_COLUMNS.items():
            _install_table(connection, table, f"{column} = {tenant}", access)
        for table, (parent, fk) in CHILDREN.items():
            match = f"EXISTS (SELECT 1 FROM {parent} p WHERE p.id = {table}.{fk} AND p.company_id = {tenant})"
            _install_table(connection, table, match, access)
        for table in BILATERAL:
            match = f"({table}.from_tenant_id = {tenant} OR {table}.to_tenant_id = {tenant})"
            _install_table(connection, table, match, access)
        for table in ("accounts", "tenants"):
            connection.execute(text(f"REVOKE ALL ON {table} FROM {ROLE}"))
        for table in ("platform_roles", "measurement_units", "unit_conversions", "activity_categories", "gwp_sets",
                      "gwp_values", "method_versions", "model_releases", "activity_records", "close_actions",
                      "report_releases", "evidence_receipts", "audit_events", "quota_accounts", "quota_transfers", "role_grants", "supplier_relationships", "supplier_access_grants", "supplier_risk_assessments", "dim_org", "activity_evidence", "quota_exchange_agreements"):
            connection.execute(text(f"REVOKE INSERT, UPDATE, DELETE ON {table} FROM {ROLE}"))
        connection.execute(text(f"SET LOCAL ROLE {ROLE}"))
        set_context(connection)
        if not all(connection.execute(text("SELECT row_security_active(to_regclass(:name))"),
                                      {"name": f"public.{table}"}).scalar_one()
                   for table in (*OWNER_COLUMNS, *CHILDREN, *BILATERAL)):
            raise RuntimeError("carbon_request is not subject to expected row security")


def _install_table(connection, table, match, access):
    reader = f"{access} = 'admin' OR ({access} IN ('enterprise', 'auditor') AND {match})"
    writer = f"{access} = 'admin' OR ({access} = 'enterprise' AND {match})"
    policies = {
        "carbon_select_v1": f"FOR SELECT TO {ROLE} USING ({reader})",
        "carbon_insert_v1": f"FOR INSERT TO {ROLE} WITH CHECK ({writer})",
        "carbon_update_v1": f"FOR UPDATE TO {ROLE} USING ({writer}) WITH CHECK ({writer})",
        "carbon_delete_v1": f"FOR DELETE TO {ROLE} USING ({writer})",
    }
    connection.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    installed = set(connection.execute(text("""
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = :table
    """), {"table": table}).scalars())
    if installed - policies.keys():
        raise RuntimeError(f"Unexpected row security policy on {table}")
    for name, definition in policies.items():
        if name not in installed:
            connection.execute(text(f"CREATE POLICY {name} ON {table} {definition}"))
