import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, Numeric, Integer, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    genre_tags: Mapped[list] = mapped_column(JSON, default=list)  # TEXT[] in db-schema.md, JSON list here for SQLite portability
    mood_tags: Mapped[list] = mapped_column(JSON, default=list)
    chord_preset_id: Mapped[str] = mapped_column(String(10), nullable=False)
    production_mode: Mapped[str] = mapped_column(String(10), nullable=False)
    vocal_source: Mapped[str] = mapped_column(String(10), nullable=False)
    structure: Mapped[list] = mapped_column(JSON, default=list)
    pattern: Mapped[dict] = mapped_column(JSON, nullable=False)
    lyrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    craft: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    originality: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    accessibility: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    experimental: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    tier: Mapped[str | None] = mapped_column(String(10), nullable=True)
    genius_event: Mapped[bool] = mapped_column(Boolean, default=False)
    sleeper_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    fans_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    money_delta: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    fame_delta: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    # Per-source revenue snapshot at release, e.g.
    # {"streaming": .., "performance": .., "ad": .., "fanclub": .., "album": .., "license": ..}
    # See docs/economy.md and services/economy.py.
    revenue_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # In-game release date — what weekly charts and season records key off.
    # released_at stays as the real-world audit timestamp.
    released_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    character: Mapped["Character"] = relationship(back_populates="songs")
    reactions: Mapped[list["SongReaction"]] = relationship(back_populates="song", cascade="all, delete-orphan")
