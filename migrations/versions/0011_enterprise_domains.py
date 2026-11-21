"""Install the remaining approved enterprise ERD entities."""
from alembic import op
from app.database import Base
from app.models import enterprise_domains
from app.services.domain_registry import PROJECTIONS

revision = "0011_enterprise_domains"
down_revision = "0010_enterprise_controls"
branch_labels = None
depends_on = None

names = {model.__tablename__ for model in vars(enterprise_domains).values()
         if isinstance(model, type) and model.__module__ == enterprise_domains.__name__ and hasattr(model, "__tablename__")}


def upgrade():
    tables = [t for t in Base.metadata.sorted_tables if t.name in names]
    Base.metadata.create_all(op.get_bind(), tables=tables, checkfirst=True)


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        connection.exec_driver_sql("DROP TRIGGER IF EXISTS zz_carbon_track_closing ON public.inventory_period_events")
        connection.exec_driver_sql("DROP FUNCTION IF EXISTS public.carbon_track_closing()")
        for source,target,*_ in PROJECTIONS:
            function = "carbon_project_" + target
            connection.exec_driver_sql(f"DROP TRIGGER IF EXISTS {function} ON public.{source}")
            connection.exec_driver_sql(f"DROP FUNCTION IF EXISTS public.{function}()")
    tables = [t for t in Base.metadata.sorted_tables if t.name in names]
    Base.metadata.drop_all(connection, tables=tables, checkfirst=True)
