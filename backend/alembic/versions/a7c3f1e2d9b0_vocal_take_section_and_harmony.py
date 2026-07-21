"""vocal take section + harmony pitch shift

Adds two nullable columns to vocal_recordings:
  - section: which song section (인트로/벌스/…) the take sings; null = whole song
  - pitch_shift: semitone shift on an auto-generated harmony take; null = sung take

Both nullable so every existing row stays valid with no backfill: a null
section means "from the top", exactly the pre-existing behaviour.

Revision ID: a7c3f1e2d9b0
Revises: 982772626576
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3f1e2d9b0"
down_revision = "982772626576"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vocal_recordings", sa.Column("section", sa.String(length=40), nullable=True))
    op.add_column("vocal_recordings", sa.Column("pitch_shift", sa.Integer(), nullable=True))


def downgrade() -> None:
    # batch_alter_table so SQLite (no native DROP COLUMN on older engines) works
    # the same as Postgres.
    with op.batch_alter_table("vocal_recordings") as batch:
        batch.drop_column("pitch_shift")
        batch.drop_column("section")
