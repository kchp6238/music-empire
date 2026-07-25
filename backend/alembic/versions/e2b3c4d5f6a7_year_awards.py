"""year-end awards tracking (last_awarded_year)

Revision ID: e2b3c4d5f6a7
Revises: d1a2b3c4e5f6
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "e2b3c4d5f6a7"
down_revision = "d1a2b3c4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 2025 = epoch year (2026) minus one, so the first full year triggers awards.
    op.add_column("characters", sa.Column("last_awarded_year", sa.Integer(), nullable=False, server_default="2025"))


def downgrade() -> None:
    with op.batch_alter_table("characters") as batch:
        batch.drop_column("last_awarded_year")
