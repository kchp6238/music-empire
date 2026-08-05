"""add character condition

0-100 condition/mental gauge — drained by promotional activities, restored by
rest; nudges music-show performance only.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('characters', sa.Column('condition', sa.Integer(), server_default='100', nullable=False))


def downgrade() -> None:
    op.drop_column('characters', 'condition')
