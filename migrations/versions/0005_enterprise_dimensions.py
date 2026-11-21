"""Add organization dimensions, BOM paths and annual emission budgets."""

from alembic import op

from app.models import BomAssembly, EmissionBudget, RecordDimensions

revision = "0005_enterprise_dimensions"
down_revision = "0004_olap_star"
branch_labels = None
depends_on = None
tables = (RecordDimensions.__table__, BomAssembly.__table__, EmissionBudget.__table__)


def upgrade():
    for table in tables:
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    for table in reversed(tables):
        table.drop(op.get_bind(), checkfirst=True)
