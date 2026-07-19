"""Fan drift + streaming income over elapsed *game* days (GDD §9).

Driven by time_service.advance_days(), not the wall clock: fans only move when
the player actually does something that consumes calendar time. Idling in the
menu earns nothing, which is the point (GDD forbids 방치형 idle loops).
"""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.fan import CharacterFanLoyalty
from app.services.js_math import js_round

STREAM_INCOME_PER_FAN_DAY = 0.5
INFLUX_PER_LOYALTY_DAY = 2.0
DAILY_CHURN_RATE = 0.008


def settle_days(db: Session, character: Character, days: int) -> dict:
    """Apply `days` worth of fan drift and passive streaming income.

    Does not commit — advance_days() owns the transaction so the whole time
    step lands atomically.
    """
    if days <= 0:
        return {"fans_delta": 0, "streaming_income": 0, "new_streams": 0}

    loyalty_rows = db.query(CharacterFanLoyalty).filter(CharacterFanLoyalty.character_id == character.id).all()
    loyalty_sum = sum(float(r.loyalty_score) for r in loyalty_rows)

    influx = js_round(loyalty_sum * INFLUX_PER_LOYALTY_DAY * days)
    # a loyal fanbase leaks more slowly
    churn_rate = max(0.0, DAILY_CHURN_RATE - loyalty_sum * 0.0005)
    churn = js_round(character.fans_count * churn_rate * days)
    fans_delta = influx - churn

    streams = max(0, js_round(character.fans_count * days))
    income = js_round(character.fans_count * STREAM_INCOME_PER_FAN_DAY * days)

    character.fans_count = max(0, character.fans_count + fans_delta)
    character.total_streams = character.total_streams + streams
    character.money = float(character.money) + income

    return {"fans_delta": fans_delta, "streaming_income": income, "new_streams": streams}
