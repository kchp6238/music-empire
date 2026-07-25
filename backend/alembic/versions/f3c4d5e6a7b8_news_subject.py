"""news subject (rival/artist thumbnail fields)

Revision ID: f3c4d5e6a7b8
Revises: e2b3c4d5f6a7
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "f3c4d5e6a7b8"
down_revision = "e2b3c4d5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("news_items", sa.Column("subject_type", sa.String(length=12), nullable=True))
    op.add_column("news_items", sa.Column("subject_id", sa.String(length=36), nullable=True))
    op.add_column("news_items", sa.Column("subject_name", sa.String(length=120), nullable=True))
    op.add_column("news_items", sa.Column("subject_color", sa.String(length=10), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("news_items") as batch:
        batch.drop_column("subject_color")
        batch.drop_column("subject_name")
        batch.drop_column("subject_id")
        batch.drop_column("subject_type")
