"""Add company inventory assignments, managed periods and decision history."""
from alembic import op

from app.models.inventory import InventoryAssignment, InventoryEvent, InventoryPeriod

revision = "0006_inventory_close"
down_revision = "0005_enterprise_dimensions"
branch_labels = None
depends_on = None
tables = (InventoryAssignment.__table__, InventoryPeriod.__table__, InventoryEvent.__table__)


def upgrade():
    for table in tables:
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    for table in reversed(tables):
        table.drop(op.get_bind(), checkfirst=True)
