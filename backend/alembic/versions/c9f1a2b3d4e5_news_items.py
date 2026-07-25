"""news items (매일의 소식 / 선택 이벤트)

Revision ID: c9f1a2b3d4e5
Revises: b8e4c2f1a9d7
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "c9f1a2b3d4e5"
down_revision = "b8e4c2f1a9d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "news_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("character_id", sa.String(length=36), sa.ForeignKey("characters.id"), nullable=False, index=True),
        sa.Column("game_date", sa.Date(), nullable=False, index=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("icon", sa.String(length=8), nullable=False, server_default="📰"),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("choices", sa.JSON(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("chosen_id", sa.String(length=30), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("news_items")
