"""Normalize prior workflow snapshots and record future operational events."""
from alembic import op
from app.models import operational_history as history

revision = "0009_operational_history"
down_revision = "0008_run_evidence"
branch_labels = None
depends_on = None
tables = (
    history.ScenarioMeasure, history.ScenarioProjection, history.ScenarioCashflow,
    history.DocumentParseRun, history.DocumentReview, history.InvoiceVerification,
)


def upgrade():
    for model in tables:
        model.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    for model in reversed(tables):
        model.__table__.drop(op.get_bind(), checkfirst=True)
