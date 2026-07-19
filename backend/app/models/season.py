import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SeasonRecord(Base):
    """A snapshot taken when a character crosses a season boundary (GDD §14 —
    no ending, so progress is tracked as a running record rather than a goal).
    """

    __tablename__ = "season_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    season_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(20), nullable=False)   # e.g. "2026 Q1"
    ended_on: Mapped[date] = mapped_column(Date, nullable=False)

    age: Mapped[int] = mapped_column(Integer, nullable=False)
    fame: Mapped[float] = mapped_column(Numeric, nullable=False)
    money: Mapped[float] = mapped_column(Numeric, nullable=False)
    fans_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_streams: Mapped[int] = mapped_column(Integer, nullable=False)
    releases_this_season: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_song: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {title, tier, score}

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
