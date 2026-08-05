import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, Integer, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MusicShowResult(Base):
    """One music-show appearance: a released song promoted on a broadcast for the
    week, with the rank it placed and whether it took #1 (a trophy). Rewards are
    applied to the character at appearance time; this is the historical record."""

    __tablename__ = "music_show_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    song_id: Mapped[str] = mapped_column(String(36), nullable=False)
    song_title: Mapped[str] = mapped_column(String(200), nullable=False)
    show_name: Mapped[str] = mapped_column(String(60), nullable=False)

    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = 순위권 밖
    is_win: Mapped[bool] = mapped_column(Boolean, default=False)
    points: Mapped[float] = mapped_column(Numeric, nullable=False)

    week: Mapped[int] = mapped_column(Integer, nullable=False)
    game_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    character: Mapped["Character"] = relationship()
