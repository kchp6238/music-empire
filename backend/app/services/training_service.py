"""Stat training — the main way to spend game time deliberately (GDD §4.1).

Skill stats are trainable and capped; talent is not touched (GDD §4.2 makes
talent fixed). Gains shrink as a stat approaches its ceiling and are scaled by
the character's `effort` talent, so "grind everything to 95" is slow and
choosing what to train matters.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.services import time_service
from app.services.js_math import js_round

TRAINABLE_STATS = ["composing", "lyrics", "arrangement", "vocal", "production", "mixing", "business", "marketing"]
STAT_LABELS = {
    "composing": "작곡", "lyrics": "작사", "arrangement": "편곡", "vocal": "보컬",
    "production": "프로듀싱", "mixing": "믹싱", "business": "비즈니스", "marketing": "마케팅",
}
TRAIN_COST = 200
STAT_CEILING = 95

# Past this age, training the physical/performance stats stops paying off as
# well — matches the age curve applied in settlement._apply_age_effects.
AGE_PENALTY_FROM = 35
AGE_PENALTY_STATS = ("vocal",)


def train(db: Session, character: Character, stat: str) -> dict:
    if stat not in TRAINABLE_STATS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"훈련할 수 없는 능력치입니다: {stat}")
    if float(character.money) < TRAIN_COST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"훈련 비용 {TRAIN_COST}원이 부족합니다")

    stats = dict(character.stats)
    current = stats.get(stat, 0)
    if current >= STAT_CEILING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 최고 수준입니다")

    character.money = float(character.money) - TRAIN_COST

    # diminishing returns near the ceiling, scaled by the effort talent
    effort = character.talent.get("effort", 50)
    headroom = (STAT_CEILING - current) / STAT_CEILING
    gain = (1.5 + random.uniform(0, 2.5)) * headroom * (0.6 + effort / 100)
    if stat in AGE_PENALTY_STATS and character.age > AGE_PENALTY_FROM:
        gain *= 0.5

    gained = max(1, js_round(gain))
    stats[stat] = min(STAT_CEILING, current + gained)
    character.stats = stats

    summary = time_service.advance_days(db, character, time_service.ACTION_DAYS["train"], reason="train")

    return {
        "time": summary,
        "message": f"{STAT_LABELS.get(stat, stat)} +{stats[stat] - current} (현재 {stats[stat]})",
    }


def rest(db: Session, character: Character) -> dict:
    """Deliberately pass a week without doing anything else.

    Exists so the player can let fans accrue, wait for a better trend, or age
    into a season boundary — time has to be spendable, not only consumable as
    a side effect of other actions.
    """
    summary = time_service.advance_days(db, character, time_service.ACTION_DAYS["rest"], reason="rest")
    return {"time": summary, "message": "일주일을 보냈습니다."}
