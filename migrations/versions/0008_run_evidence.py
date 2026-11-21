"""Persist structured calculation lineage and immutable reports."""
from alembic import op

from app.models.evidence import CalculationInput, EmissionResultLine, ReportArtifact

revision = "0008_run_evidence"
down_revision = "0007_enterprise_operations"
branch_labels = None
depends_on = None

tables = (CalculationInput, EmissionResultLine, ReportArtifact)


def upgrade():
    for model in tables:
        model.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    for model in reversed(tables):
        model.__table__.drop(op.get_bind(), checkfirst=True)
