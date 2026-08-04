import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Album(Base):
    """A body of work: 2+ of the character's released songs bundled with a title
    track. Created already "released" — releasing an album is a one-shot event
    that grants a fame/money/fans bonus scaled by track count and quality. The
    member songs are referenced by id (JSON list, SQLite-portable) rather than a
    link table; a song can appear on more than one compilation."""

    __tablename__ = "albums"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # 'ep' (2-3) | 'lp' (4+)
    concept: Mapped[str | None] = mapped_column(String(120), nullable=True)
    title_song_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    song_ids: Mapped[list] = mapped_column(JSON, default=list)

    track_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    tier: Mapped[str | None] = mapped_column(String(10), nullable=True)
    total_streams: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    fame_delta: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    money_delta: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    fans_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)

    released_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    character: Mapped["Character"] = relationship()
