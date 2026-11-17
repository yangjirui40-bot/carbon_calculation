"""供应商门户与配额交易：users.supplier_id + supplier_submissions + quota_trades。

Revision ID: 0002_supplier_portal
Revises: 0001_initial
Create Date: 2026-11-17

说明：0001 基线使用当前 ORM 元数据幂等建表（含本迁移的表结构），因此本迁移对
已存在的对象做幂等跳过，保证在“新库 / 旧库 / 已部分应用”三种状态下均可执行。
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_supplier_portal"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def _has_table(table: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if not _has_column("users", "supplier_id"):
        op.add_column("users", sa.Column("supplier_id", sa.String(64), nullable=True))

    if not _has_table("supplier_submissions"):
        op.create_table(
            "supplier_submissions",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("supplier_id", sa.String(64), nullable=False, index=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("period", sa.String(16), nullable=False),
            sa.Column("reported_emissions", sa.Float, nullable=False, server_default="0"),
            sa.Column("reported_intensity", sa.Float, nullable=True),
            sa.Column("note", sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    if not _has_table("quota_trades"):
        op.create_table(
            "quota_trades",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("trade_id", sa.String(64), unique=True, nullable=False, index=True),
            sa.Column("seller_company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("buyer_company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("year", sa.Integer, nullable=False, server_default="2026"),
            sa.Column("amount", sa.Float, nullable=False, server_default="0"),
            sa.Column("price", sa.Float, nullable=False, server_default="0"),
            sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
            sa.Column("note", sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    if _has_table("quota_trades"):
        op.drop_table("quota_trades")
    if _has_table("supplier_submissions"):
        op.drop_table("supplier_submissions")
    if _has_column("users", "supplier_id"):
        op.drop_column("users", "supplier_id")
