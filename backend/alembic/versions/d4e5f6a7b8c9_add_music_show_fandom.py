"""add music-show results + fandom fields

Fandom name + weekly music-show promotion. Character gains `fandom_name` and
`last_music_show_week` (promo is once per game-week); appearances are logged in
`music_show_results`. See models/music.py, services/music_service.py.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('characters', sa.Column('fandom_name', sa.String(length=80), nullable=True))
    op.add_column('characters', sa.Column('last_music_show_week', sa.Integer(), server_default='-1', nullable=False))

    op.create_table(
        'music_show_results',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('character_id', sa.String(length=36), nullable=False),
        sa.Column('song_id', sa.String(length=36), nullable=False),
        sa.Column('song_title', sa.String(length=200), nullable=False),
        sa.Column('show_name', sa.String(length=60), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=True),
        sa.Column('is_win', sa.Boolean(), nullable=True),
        sa.Column('points', sa.Numeric(), nullable=False),
        sa.Column('week', sa.Integer(), nullable=False),
        sa.Column('game_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_music_show_results_character_id'), 'music_show_results', ['character_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_music_show_results_character_id'), table_name='music_show_results')
    op.drop_table('music_show_results')
    op.drop_column('characters', 'last_music_show_week')
    op.drop_column('characters', 'fandom_name')
