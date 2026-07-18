"""Offline fan drift + passive streaming income (GDD §9, docs/core-loop.md §3/§5).

Runs as a login-time batch (not a cron): whenever a character is loaded we
settle the elapsed time since last_simulated_at in one shot. Loyal personas
keep bringing new fans; long inactivity churns low-loyalty ones; the standing
fanbase throws off streaming royalties over time.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.fan import CharacterFanLoyalty
from app.services.js_math import js_round

MAX_ELAPSED_DAYS = 30          # cap a single settle so a long absence can't explode
STREAM_INCOME_PER_FAN_DAY = 0.5
INFLUX_PER_LOYALTY_DAY = 2.0
DAILY_CHURN_RATE = 0.008


def settle(db: Session, character: Character, now: datetime | None = None) -> dict | None:
    now = now or datetime.now(timezone.utc)
    last = character.last_simulated_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    elapsed_days = (now - last).total_seconds() / 86400
    if elapsed_days < 1:
        return None  # nothing to settle yet

    days = min(elapsed_days, MAX_ELAPSED_DAYS)

    loyalty_rows = db.query(CharacterFanLoyalty).filter(CharacterFanLoyalty.character_id == character.id).all()
    loyalty_sum = sum(float(r.loyalty_score) for r in loyalty_rows)

    influx = js_round(loyalty_sum * INFLUX_PER_LOYALTY_DAY * days)
    # churn is dampened by how loyal the overall fanbase is
    churn_rate = max(0.0, DAILY_CHURN_RATE - loyalty_sum * 0.0005)
    churn = js_round(character.fans_count * churn_rate * days)
    fans_delta = influx - churn

    streams = js_round(character.fans_count * days)  # rough play count
    income = js_round(character.fans_count * STREAM_INCOME_PER_FAN_DAY * days)

    character.fans_count = max(0, character.fans_count + fans_delta)
    character.total_streams = character.total_streams + max(0, streams)
    character.money = float(character.money) + income
    character.last_simulated_at = now
    db.commit()

    return {
        "elapsed_days": round(days, 1),
        "fans_delta": fans_delta,
        "streaming_income": income,
        "new_streams": max(0, streams),
    }
