from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CharacterAchievement(Base):
    """Which achievements a character has unlocked. Achievement *definitions*
    live in code (services/achievements.py); only unlocks are persisted."""

    __tablename__ = "character_achievements"

    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), primary_key=True)
    achievement_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
