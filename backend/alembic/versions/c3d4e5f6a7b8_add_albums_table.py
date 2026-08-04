"""add albums table

Bundles 2+ of a character's released songs into an EP/LP with a title track.
Member songs are referenced by id in a JSON list (see models/album.py), so no
link table is needed.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'albums',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('character_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('concept', sa.String(length=120), nullable=True),
        sa.Column('title_song_id', sa.String(length=36), nullable=True),
        sa.Column('song_ids', sa.JSON(), nullable=True),
        sa.Column('track_count', sa.Integer(), nullable=False),
        sa.Column('avg_score', sa.Numeric(), nullable=True),
        sa.Column('tier', sa.String(length=10), nullable=True),
        sa.Column('total_streams', sa.Integer(), server_default='0', nullable=False),
        sa.Column('fame_delta', sa.Numeric(), nullable=True),
        sa.Column('money_delta', sa.Numeric(), nullable=True),
        sa.Column('fans_delta', sa.Integer(), nullable=True),
        sa.Column('released_on', sa.Date(), nullable=True),
        sa.Column('released_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_albums_character_id'), 'albums', ['character_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_albums_character_id'), table_name='albums')
    op.drop_table('albums')
