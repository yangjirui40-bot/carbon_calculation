"""Populate the enterprise catalog from the operational records that establish its facts."""
import hashlib
from pathlib import Path

from sqlalchemy import text
from ..database import SessionLocal
from ..models.enterprise_domains import ActivityCategory, MeasurementUnit, MethodVersion, ModelRelease, PlatformRole, UnitConversion
from datetime import date

# Each SELECT projects exactly one source row into its stable ERD identity.
# Neither passwords nor source IPs belong in these analytical and evidence projections.
PROJECTIONS = (
    ("companies","tenants","id code name status","s.id,s.code,s.name,'active'",""),
    ("users","accounts","id login email status identity_provider","s.id,s.username,s.email,CASE WHEN s.is_active THEN 'active' ELSE 'disabled' END,'local'",""),
    ("business_records","activity_records","id tenant_id record_no period_label category_id period_id",
     "s.id,s.company_id,s.record_no,s.period,c.id,r.inventory_id",
     "LEFT JOIN public.activity_categories c ON c.category_code=s.category LEFT JOIN public.inventory_periods p ON p.company_id=s.company_id AND p.period=s.period LEFT JOIN public.reporting_periods r ON r.inventory_id=p.id"),
    ("reports","report_releases","id tenant_id report_no run_id report_kind issue_no assurance_state release_state",
     "s.id,s.company_id,s.report_no,r.id,s.report_type,s.id,'not_independently_verified',s.status",
     "LEFT JOIN public.calculation_runs r ON r.run_id=s.run_id AND r.company_id=s.company_id"),
    ("blockchain_attestations","evidence_receipts","id tenant_id run_id method content_digest previous_digest external_state created_at",
     "s.id,r.company_id,r.id,'SHA-256',s.attestation_hash,s.prev_hash,'internal',s.onchain_time",
     "JOIN public.calculation_runs r ON r.run_id=s.run_id AND r.company_id IS NOT NULL"),
    ("audit_logs","audit_events","id tenant_id actor_id run_id event_type target_ref occurred_at request_id detail",
     "s.id,r.company_id,m.id,r.id,s.action,s.run_id,s.created_at,NULL,COALESCE(s.detail,'{}'::json)",
     "JOIN public.calculation_runs r ON r.run_id=s.run_id AND r.company_id IS NOT NULL LEFT JOIN public.tenant_members m ON m.account_id=s.actor_user_id AND m.tenant_id=r.company_id"),
    ("inventory_period_events","close_actions","id tenant_id actor_id action rationale performed_at",
     "s.id,p.company_id,m.id,s.action,s.note,s.created_at","JOIN public.inventory_periods p ON p.id=s.period_id LEFT JOIN public.tenant_members m ON m.account_id=s.actor_id AND m.tenant_id=p.company_id"),
    ("carbon_quotas","quota_accounts","id tenant_id account_code supplier_id compliance_year account_status",
     "s.id,s.company_id,'quota-'||s.id::text,v.id,s.year,'open'",
     "LEFT JOIN public.suppliers v ON v.company_id=s.company_id AND v.supplier_id=s.supplier_id"),
    ("tenant_members","role_grants","id tenant_id member_id role_id valid_from",
     "s.id,s.tenant_id,s.id,r.id,s.created_at","JOIN public.users u ON u.id=s.account_id JOIN public.platform_roles r ON r.code=u.role"),
    ("users","supplier_access_grants","id tenant_id supplier_id account_id valid_from valid_to state",
     "s.id,s.company_id,v.id,s.id,s.created_at,CASE WHEN s.is_active THEN NULL ELSE s.updated_at END,CASE WHEN s.is_active THEN 'active' ELSE 'disabled' END",
     "JOIN public.suppliers v ON v.supplier_id=s.supplier_id AND v.company_id=s.company_id AND s.role='supplier'"),
    ("supply_chain_edges","supplier_relationships","id tenant_id downstream_supplier_id upstream_supplier_id relation_type amount",
     "s.id,v.company_id,d.id,v.id,s.relation_type,s.amount",
     "JOIN public.suppliers v ON v.supplier_id=s.target_id AND v.company_id IS NOT NULL JOIN public.companies c ON c.id=v.company_id LEFT JOIN public.suppliers d ON d.company_id=c.id AND d.supplier_id=s.source_id JOIN LATERAL (SELECT 1 WHERE d.id IS NOT NULL OR s.source_id=c.code) allowed ON true"),
    ("activity_revisions","activity_evidence","id tenant_id activity_revision_id document_id raw_object_id evidence_role",
     "s.id,s.tenant_id,s.id,d.id,o.document_id,'source_document'",
     "JOIN public.source_documents d ON d.company_id=s.tenant_id AND d.id::text=s.snapshot->>'document_id' LEFT JOIN public.raw_objects o ON o.document_id=d.id"),
    ("org_units","dim_org","id tenant_id site_id org_unit_id hierarchy_path valid_from",
     "s.id,s.tenant_id,s.site_id,s.id,concat_ws('/',t.code,q.code,s.code),s.created_at::date",
     "JOIN public.sites t ON t.id=s.site_id LEFT JOIN public.org_units q ON q.id=s.parent_id"),
    ("supplier_emission_data","supplier_risk_assessments","id tenant_id supplier_id period_id source_data_id risk_level data_origin intensity threshold_version",
     "s.id,r.tenant_id,r.supplier_id,p.id,s.id,CASE WHEN s.intensity IS NULL THEN 'unknown' WHEN s.intensity>=0.4 THEN 'red' WHEN s.intensity>=0.2 THEN 'yellow' ELSE 'green' END,'approved_supplier_disclosure',s.intensity,'heatmap-kgCO2e-per-CNY-0.2-0.4'",
     "JOIN public.disclosure_requests r ON r.id=s.request_id AND s.state='approved' JOIN public.inventory_periods p ON p.company_id=r.tenant_id AND p.period=r.period JOIN public.reporting_periods rp ON rp.inventory_id=p.id"),
    ("quota_trades","quota_exchange_agreements","id from_tenant_id to_tenant_id purpose valid_from status",
     "s.id,s.seller_company_id,s.buyer_company_id,'single_trade:'||s.trade_id,s.updated_at,'accepted'",
     "JOIN public.tenants t ON s.status='accepted' AND t.id=s.buyer_company_id AND s.seller_company_id<>s.buyer_company_id"),
    ("quota_trades","quota_transfers","id from_tenant_id to_tenant_id quantity_kgco2e reference_price currency state idempotency_key agreement_id",
     "s.id,s.seller_company_id,s.buyer_company_id,s.amount,s.price,'CNY',s.status,s.trade_id,g.id","LEFT JOIN public.quota_exchange_agreements g ON g.id=s.id"),
)


def install_projections(db):
    if db.bind.dialect.name != "postgresql":
        return
    for source, target, columns, expressions, joins in PROJECTIONS:
        cols = columns.split()
        insert = f"INSERT INTO public.{target} ({','.join(cols)}) SELECT {expressions} FROM public.{source} s {joins}"
        update = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols[1:])
        db.execute(text(f"{insert} WHERE NOT EXISTS (SELECT 1 FROM public.{target} dest WHERE dest.id=s.id) ON CONFLICT (id) DO NOTHING"))
        function = "carbon_project_"+target
        db.execute(text(f"""CREATE OR REPLACE FUNCTION public.{function}() RETURNS trigger
            LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
            BEGIN {insert} WHERE s.id=NEW.id ON CONFLICT (id) DO UPDATE SET {update}; RETURN NEW; END $$"""))
        db.execute(text(f"DROP TRIGGER IF EXISTS {function} ON public.{source}"))
        db.execute(text(f"CREATE TRIGGER {function} AFTER INSERT OR UPDATE ON public.{source} FOR EACH ROW EXECUTE FUNCTION public.{function}()"))


def seed_catalog(db):
    units = {"kWh":("千瓦时","energy"),"MWh":("兆瓦时","energy"),"Wh":("瓦时","energy"),"kg":("千克","mass"),
             "t":("吨","mass"),"L":("升","volume"),"m3":("立方米","volume"),"CNY":("人民币元","currency"),"tkm":("吨公里","transport")}
    indexed = {x.ucum_code:x for x in db.query(MeasurementUnit)}
    for code,(name,dimension) in units.items():
        if code not in indexed:
            indexed[code]=MeasurementUnit(ucum_code=code,name=name,dimension=dimension)
            db.add(indexed[code])
    db.flush()
    for a,b,r in (("MWh","kWh",1000),("Wh","kWh",0.001),("t","kg",1000),("m3","L",1000)):
        if not db.query(UnitConversion.id).filter_by(from_unit_id=indexed[a].id,to_unit_id=indexed[b].id).first():
            db.add(UnitConversion(from_unit_id=indexed[a].id,to_unit_id=indexed[b].id,multiplier=r,valid_start=date(1970,1,1),source_ref="SI decimal unit relationships"))
    roles={"admin":("平台管理员",["platform.manage"]),"enterprise":("企业员工",["inventory.write"]),"auditor":("企业审计",["inventory.read"]),"supplier":("供应商",["disclosure.respond"])}
    for code,(name,rights) in roles.items():
        if not db.query(PlatformRole.id).filter_by(code=code).first():
            db.add(PlatformRole(code=code,name=name,capability_keys=rights))
    from ..models import EmissionFactor
    for category,scope in db.query(EmissionFactor.category,EmissionFactor.scope).distinct():
        if not db.query(ActivityCategory.id).filter_by(category_code=category).first():
            basis = [v[0].rsplit("/",1)[-1] for v in db.query(EmissionFactor.unit).filter_by(category=category).distinct()]
            db.add(ActivityCategory(category_code=category,name=category,scope=int(scope[-1]),allowed_bases=sorted(basis)))
            db.flush()
    for name,basis,boundary,source in (("enterprise","ledger","organization","calculation_service.py"),
                                       ("product","inventory","product","calculation_service.py"),
                                       ("eiolca","procurement","domestic_production","research_catalog.py")):
        digest=hashlib.sha256(Path(__file__).with_name(source).read_bytes()).hexdigest()
        if not db.query(MethodVersion.id).filter_by(method_code=name,version=digest).first():
            db.add(MethodVersion(method_code=name,version=digest,activity_basis=basis,boundary_kind=boundary,
                                 source_ref=source,calculation_contract={"implementation_sha256":digest}))
    parser=Path(__file__).with_name("document_parser.py")
    digest=hashlib.sha256(parser.read_bytes()).hexdigest()
    if not db.query(ModelRelease.id).filter_by(model_code="document_parser",version=digest).first():
        db.add(ModelRelease(model_code="document_parser",version=digest,provider="CarbonSpeed",engine_type="extraction_pipeline",
                            artifact_uri="app/services/document_parser.py",artifact_hash=digest,status="installed"))


def initialize():
    with SessionLocal.begin() as db:
        if db.bind.dialect.name=="postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(78831227)"))
        from .product_inventory import backfill
        from .factor_basis import register
        register(db)
        seed_catalog(db)
        db.flush()
        backfill(db)
        if db.bind.dialect.name=="postgresql":
            db.execute(text("""INSERT INTO factor_gas_components(tenant_id,factor_version_id,gas_code,kg_per_base_unit)
                SELECT s.tenant_id,s.id,'CO2',f.value FROM factor_versions s JOIN factor_sources o ON o.id=s.source_id
                JOIN emission_factors f ON f.id=s.emission_factor_id WHERE upper(replace(trim(o.gas_coverage),'₂','2'))='CO2'
                ON CONFLICT(factor_version_id,gas_code) DO NOTHING"""))
        install_projections(db)
        from .closing_versions import install
        install(db)


def notify_member(db, tenant_id, account_id, event_kind, source_key, message):
    from ..models.enterprise_domains import NotificationDelivery
    from ..models.organization import TenantMember
    from ..models.base import utcnow
    member=db.query(TenantMember.id).filter_by(tenant_id=tenant_id,account_id=account_id).scalar()
    if member:
        db.add(NotificationDelivery(tenant_id=tenant_id,recipient_id=member,channel="in_app",event_kind=event_kind,
               source_key=source_key,state="available",sent_at=utcnow(),message=message))
