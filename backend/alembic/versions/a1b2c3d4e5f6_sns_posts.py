"""in-game SNS: posts, likes, comments

Revision ID: a1b2c3d4e5f6
Revises: f3c4d5e6a7b8
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f3c4d5e6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sns_posts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("world_id", sa.String(length=36), sa.ForeignKey("worlds.id"), nullable=False, index=True),
        sa.Column("author_type", sa.String(length=10), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("author_color", sa.String(length=10), nullable=True),
        sa.Column("caption", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_kind", sa.String(length=12), nullable=False, server_default="glyph"),
        sa.Column("image_ref", sa.String(length=80), nullable=True),
        sa.Column("song_id", sa.String(length=36), nullable=True),
        sa.Column("likes_base", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("game_date", sa.Date(), nullable=False),
        sa.Column("dedupe_key", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("world_id", "dedupe_key", name="uq_sns_post_dedupe"),
    )
    op.create_table(
        "sns_likes",
        sa.Column("post_id", sa.String(length=36), sa.ForeignKey("sns_posts.id"), primary_key=True),
        sa.Column("character_id", sa.String(length=36), sa.ForeignKey("characters.id"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "sns_comments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("post_id", sa.String(length=36), sa.ForeignKey("sns_posts.id"), nullable=False, index=True),
        sa.Column("author_type", sa.String(length=10), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("author_color", sa.String(length=10), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sns_comments")
    op.drop_table("sns_likes")
    op.drop_table("sns_posts")
