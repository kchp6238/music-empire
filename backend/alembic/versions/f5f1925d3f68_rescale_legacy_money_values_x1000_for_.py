"""rescale legacy money values x1000 for new economy

All money constants in the game (starting capital, training/company costs,
release income, catalogue royalties, achievement thresholds) moved from an
abstract "hundreds of won" scale to a realistic KRW scale in this release —
see services/scoring.py, training_service.py, company_service.py,
game_data.py. Existing rows predate that change and are still denominated in
the old scale, so this data-only migration multiplies every persisted money
value by 1000 to match. Player-set prices (concert tickets, marketplace
listings) are included too, since they were chosen under the old scale's
intuition and would otherwise read as near-free under the new one.

Revision ID: f5f1925d3f68
Revises: afe596b813f2
Create Date: 2026-07-20 03:55:14.331301

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5f1925d3f68'
down_revision: Union[str, None] = 'afe596b813f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCALE = 1000

# Plain numeric money columns: straightforward column * SCALE.
FLAT_COLUMNS = [
    ("characters", "money"),
    ("songs", "money_delta"),
    ("companies", "capital"),
    ("season_records", "money"),
    ("concerts", "ticket_price"),
    ("marketplace_listings", "price"),
]

REVENUE_BREAKDOWN_KEYS = ["streaming", "performance", "ad", "fanclub", "album", "license", "expenses", "net"]


def upgrade() -> None:
    bind = op.get_bind()

    for table, column in FLAT_COLUMNS:
        bind.execute(sa.text(f"UPDATE {table} SET {column} = {column} * :scale WHERE {column} IS NOT NULL"), {"scale": SCALE})

    # revenue_breakdown is a JSON blob of per-source amounts (see economy.py)
    # keyed the same way in every row — scale each numeric value in place.
    rows = bind.execute(sa.text("SELECT id, revenue_breakdown FROM songs WHERE revenue_breakdown IS NOT NULL")).fetchall()
    for row_id, breakdown in rows:
        if isinstance(breakdown, str):
            breakdown = json.loads(breakdown)
        if not isinstance(breakdown, dict):
            continue
        scaled = {k: (v * SCALE if k in REVENUE_BREAKDOWN_KEYS and isinstance(v, (int, float)) else v) for k, v in breakdown.items()}
        bind.execute(
            sa.text("UPDATE songs SET revenue_breakdown = :breakdown WHERE id = :id"),
            {"breakdown": json.dumps(scaled), "id": row_id},
        )


def downgrade() -> None:
    bind = op.get_bind()

    for table, column in FLAT_COLUMNS:
        bind.execute(sa.text(f"UPDATE {table} SET {column} = {column} / :scale WHERE {column} IS NOT NULL"), {"scale": SCALE})

    rows = bind.execute(sa.text("SELECT id, revenue_breakdown FROM songs WHERE revenue_breakdown IS NOT NULL")).fetchall()
    for row_id, breakdown in rows:
        if isinstance(breakdown, str):
            breakdown = json.loads(breakdown)
        if not isinstance(breakdown, dict):
            continue
        scaled = {k: (v / SCALE if k in REVENUE_BREAKDOWN_KEYS and isinstance(v, (int, float)) else v) for k, v in breakdown.items()}
        bind.execute(
            sa.text("UPDATE songs SET revenue_breakdown = :breakdown WHERE id = :id"),
            {"breakdown": json.dumps(scaled), "id": row_id},
        )
