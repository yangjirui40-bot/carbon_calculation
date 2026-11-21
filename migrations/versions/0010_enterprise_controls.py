"""Register electricity instruments, physical document evidence and enterprise journals."""
from alembic import op
from app.models import enterprise_controls as controls
from app.services.quota_ledger import install_quota_ledger

revision = "0010_enterprise_controls"
down_revision = "0009_operational_history"
branch_labels = None
depends_on = None
tables = (controls.EnergyCertificate, controls.CertificateAllocation, controls.QuotaEntry,
          controls.ReductionProgressEvent, controls.UsageEvent, controls.WarehouseRefresh,
          controls.RawObject, controls.DocumentPage, controls.ExtractedField, controls.PeriodResponsibility, controls.QualityIssue,
          controls.IoDatasetVersion, controls.IoSector, controls.IoIntensity, controls.IoSectorMap,
          controls.IoDerivationRun, controls.FactorSet, controls.FactorSetEntry)


def upgrade():
    connection = op.get_bind()
    for model in tables:
        model.__table__.create(connection, checkfirst=True)
    install_quota_ledger(connection)


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        connection.exec_driver_sql("DROP TRIGGER IF EXISTS quota_journal ON public.carbon_quotas")
        connection.exec_driver_sql("DROP FUNCTION IF EXISTS public.carbon_post_quota()")
    elif connection.dialect.name == "sqlite":
        for action in ("INSERT", "UPDATE"):
            connection.exec_driver_sql("DROP TRIGGER IF EXISTS quota_entries_" + action)
    for model in reversed(tables):
        model.__table__.drop(connection, checkfirst=True)
