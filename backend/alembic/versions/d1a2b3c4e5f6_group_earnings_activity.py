"""group earnings + activity log

Revision ID: d1a2b3c4e5f6
Revises: c9f1a2b3d4e5
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "d1a2b3c4e5f6"
down_revision = "c9f1a2b3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("total_earnings", sa.Numeric(), nullable=False, server_default="0"))
    op.add_column("groups", sa.Column("activity_log", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("groups") as batch:
        batch.drop_column("activity_log")
        batch.drop_column("total_earnings")
