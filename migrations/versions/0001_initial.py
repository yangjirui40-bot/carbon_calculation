"""初始基线：按当前 ORM 元数据建表（幂等）。

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-17
"""
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "vendor"))
    from app.database import Base
    from app import models as _models  # noqa: F401

    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "vendor"))
    from app.database import Base

    Base.metadata.drop_all(bind=op.get_bind())
