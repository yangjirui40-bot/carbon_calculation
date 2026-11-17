"""OLAP 星型模型：维度表与事实表。

Revision ID: 0004_olap_star
Revises: 0003_accuracy
Create Date: 2026-11-18
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_olap_star"
down_revision = "0003_accuracy"
branch_labels = None
depends_on = None


def _has_table(table: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return table in insp.get_table_names()


def upgrade() -> None:
    if not _has_table("dim_company"):
        op.create_table(
            "dim_company",
            sa.Column("company_key", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer, unique=True, nullable=False, index=True),
            sa.Column("code", sa.String(64), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("industry", sa.String(128), nullable=True),
            sa.Column("region", sa.String(128), nullable=True),
        )
    if not _has_table("dim_period"):
        op.create_table(
            "dim_period",
            sa.Column("period_key", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("period", sa.String(16), unique=True, nullable=False, index=True),
            sa.Column("year", sa.Integer, nullable=False),
            sa.Column("month", sa.Integer, nullable=False),
        )
    if not _has_table("dim_category"):
        op.create_table(
            "dim_category",
            sa.Column("category_key", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("category", sa.String(64), unique=True, nullable=False, index=True),
            sa.Column("scope", sa.String(16), nullable=False),
        )
    if not _has_table("dim_supplier"):
        op.create_table(
            "dim_supplier",
            sa.Column("supplier_key", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("supplier_id", sa.String(64), unique=True, nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("industry", sa.String(128), nullable=True),
            sa.Column("region", sa.String(128), nullable=True),
            sa.Column("tier", sa.Integer, nullable=True),
        )
    if not _has_table("fact_emission"):
        op.create_table(
            "fact_emission",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("company_key", sa.Integer, sa.ForeignKey("dim_company.company_key"), nullable=False, index=True),
            sa.Column("period_key", sa.Integer, sa.ForeignKey("dim_period.period_key"), nullable=False, index=True),
            sa.Column("category_key", sa.Integer, sa.ForeignKey("dim_category.category_key"), nullable=False, index=True),
            sa.Column("supplier_key", sa.Integer, sa.ForeignKey("dim_supplier.supplier_key"), nullable=True),
            sa.Column("record_no", sa.String(64), nullable=False),
            sa.Column("activity_qty", sa.Float, nullable=True),
            sa.Column("amount_cny", sa.Float, nullable=True),
            sa.Column("emissions_kgco2e", sa.Float, nullable=False),
            sa.Column("factor_id", sa.String(64), nullable=False),
            sa.Column("factor_version", sa.String(64), nullable=True),
            sa.Column("is_demo", sa.Boolean, nullable=False, server_default="true"),
        )
    if not _has_table("fact_company_emission"):
        op.create_table(
            "fact_company_emission",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("company_key", sa.Integer, sa.ForeignKey("dim_company.company_key"), nullable=False, index=True),
            sa.Column("period_key", sa.Integer, sa.ForeignKey("dim_period.period_key"), nullable=False, index=True),
            sa.Column("scope1", sa.Float, nullable=False, server_default="0"),
            sa.Column("scope2", sa.Float, nullable=False, server_default="0"),
            sa.Column("scope3", sa.Float, nullable=False, server_default="0"),
            sa.Column("total", sa.Float, nullable=False, server_default="0"),
            sa.Column("record_count", sa.Integer, nullable=False, server_default="0"),
        )


def downgrade() -> None:
    for t in ("fact_company_emission", "fact_emission", "dim_supplier",
              "dim_category", "dim_period", "dim_company"):
        if _has_table(t):
            op.drop_table(t)
