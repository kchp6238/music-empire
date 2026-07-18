import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FanPersona(Base):
    __tablename__ = "fan_personas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str | None] = mapped_column(String(10), nullable=True)
    genre_pref: Mapped[dict] = mapped_column(JSON, nullable=False)
    mood_pref: Mapped[dict] = mapped_column(JSON, nullable=False)
    openness: Mapped[float] = mapped_column(Numeric, nullable=False)


class CharacterFanLoyalty(Base):
    __tablename__ = "character_fan_loyalty"

    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("fan_personas.id"), primary_key=True)
    loyalty_score: Mapped[float] = mapped_column(Numeric, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    character: Mapped["Character"] = relationship(back_populates="loyalty")
    persona: Mapped["FanPersona"] = relationship()


class SongReaction(Base):
    __tablename__ = "song_reactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_id: Mapped[str] = mapped_column(String(36), ForeignKey("songs.id"), nullable=False, index=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("fan_personas.id"), nullable=False)
    reached: Mapped[bool] = mapped_column(Boolean, nullable=False)
    affinity: Mapped[float] = mapped_column(Numeric, nullable=False)
    reaction_score: Mapped[float] = mapped_column(Numeric, nullable=False)
    comment_line: Mapped[str | None] = mapped_column(String(255), nullable=True)

    song: Mapped["Song"] = relationship(back_populates="reactions")
    persona: Mapped["FanPersona"] = relationship()
