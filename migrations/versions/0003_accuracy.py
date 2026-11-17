"""官方因子与不确定性：排放因子元数据、发票验真状态、复核留痕。

Revision ID: 0003_accuracy
Revises: 0002_supplier_portal
Create Date: 2026-11-17
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_accuracy"
down_revision = "0002_supplier_portal"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    if not _has_column("emission_factors", "uncertainty_pct"):
        op.add_column("emission_factors", sa.Column("uncertainty_pct", sa.Float, nullable=True))
    if not _has_column("source_documents", "verified_status"):
        op.add_column("source_documents", sa.Column(
            "verified_status", sa.String(16), nullable=False, server_default="unverified"))
    if not _has_column("source_documents", "reviewed_by_user_id"):
        op.add_column("source_documents", sa.Column(
            "reviewed_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    if not _has_column("source_documents", "review_note"):
        op.add_column("source_documents", sa.Column("review_note", sa.String(512), nullable=True))
    if not _has_column("source_documents", "content_hash"):
        op.add_column("source_documents", sa.Column(
            "content_hash", sa.String(64), nullable=True, index=True))


def downgrade() -> None:
    for table, col in (
        ("source_documents", "content_hash"),
        ("source_documents", "review_note"),
        ("source_documents", "reviewed_by_user_id"),
        ("source_documents", "verified_status"),
        ("emission_factors", "uncertainty_pct"),
    ):
        if _has_column(table, col):
            op.drop_column(table, col)
