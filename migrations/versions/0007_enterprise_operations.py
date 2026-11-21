"""Add organization, structured inventories, PCF versions, and supplier disclosures."""
from alembic import op
from app.models import company_factors, disclosure, ingestion, organization, product_versions

revision = "0007_enterprise_operations"
down_revision = "0006_inventory_close"
branch_labels = None
depends_on = None

tables = (
    organization.TenantMember, organization.TenantInvite, organization.LegalEntity,
    organization.Site, organization.OrgUnit, organization.ReportingBoundary, organization.BoundaryMember,
    organization.ReportingPeriod, organization.ActivityLocation, organization.ScopeAssessment, organization.ActivityRevision,
    disclosure.DisclosureCampaign, disclosure.DisclosureRequest, disclosure.SupplierEmissionData,
    product_versions.BomVersion, product_versions.ProductStudy, product_versions.PcfAllocation,
    company_factors.FactorSource, company_factors.CompanyFactorVersion,
    ingestion.DataConnection, ingestion.IngestBatch,
)


def upgrade():
    for model in tables:
        model.__table__.create(op.get_bind(),checkfirst=True)


def downgrade():
    for model in reversed(tables):
        model.__table__.drop(op.get_bind(),checkfirst=True)
