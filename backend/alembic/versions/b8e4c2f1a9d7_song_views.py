"""song views (조회수)

Adds a non-null views counter to songs, default 0, so existing rows backfill to
0 automatically.

Revision ID: b8e4c2f1a9d7
Revises: a7c3f1e2d9b0
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "b8e4c2f1a9d7"
down_revision = "a7c3f1e2d9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("views", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("songs") as batch:
        batch.drop_column("views")
