"""in-game phone messages (DM)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dm_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("world_id", sa.String(length=36), sa.ForeignKey("worlds.id"), nullable=False, index=True),
        sa.Column("character_id", sa.String(length=36), sa.ForeignKey("characters.id"), nullable=False, index=True),
        sa.Column("thread_key", sa.String(length=48), nullable=False),
        sa.Column("thread_name", sa.String(length=120), nullable=False),
        sa.Column("thread_color", sa.String(length=10), nullable=True),
        sa.Column("from_me", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("game_date", sa.Date(), nullable=False),
        sa.Column("read_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("dedupe_key", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("character_id", "dedupe_key", name="uq_dm_dedupe"),
    )


def downgrade() -> None:
    op.drop_table("dm_messages")
