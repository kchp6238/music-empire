"""add song_covers table

Album art drawn in-game. Its own table rather than columns on `songs` so the
image bytes never ride along with the feed/chart/history queries that select
whole Song rows — see models/cover.py.

Revision ID: 3fa3368e669d
Revises: f5f1925d3f68
Create Date: 2026-07-20 17:56:22.788611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fa3368e669d'
down_revision: Union[str, None] = 'f5f1925d3f68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'song_covers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('song_id', sa.String(length=36), nullable=False),
        sa.Column('character_id', sa.String(length=36), nullable=False),
        sa.Column('image_data', sa.LargeBinary(), nullable=False),
        sa.Column('mime_type', sa.String(length=80), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ),
        sa.ForeignKeyConstraint(['song_id'], ['songs.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_song_covers_character_id'), 'song_covers', ['character_id'], unique=False)
    op.create_index(op.f('ix_song_covers_song_id'), 'song_covers', ['song_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_song_covers_song_id'), table_name='song_covers')
    op.drop_index(op.f('ix_song_covers_character_id'), table_name='song_covers')
    op.drop_table('song_covers')
