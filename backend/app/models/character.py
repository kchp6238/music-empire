import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Every career starts here, so seasons/weeks line up across players regardless
# of when they actually signed up.
GAME_EPOCH = date(2026, 1, 1)


class Character(Base):
    __tablename__ = "characters"
    # One career per save, not one per account: a player holds several saves at
    # once (a solo world plus whatever multi rooms they've joined), so the old
    # unique(user_id) is now scoped by world.
    __table_args__ = (UniqueConstraint("user_id", "world_id", name="uq_character_user_world"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    world_id: Mapped[str] = mapped_column(String(36), ForeignKey("worlds.id"), nullable=False, index=True)
    artist_name: Mapped[str] = mapped_column(String(120), nullable=False)
    background_id: Mapped[str] = mapped_column(String(40), nullable=False)
    background_name: Mapped[str] = mapped_column(String(120), nullable=False)
    stats: Mapped[dict] = mapped_column(JSON, nullable=False)
    talent: Mapped[dict] = mapped_column(JSON, nullable=False)
    fame: Mapped[float] = mapped_column(Numeric, nullable=False)
    money: Mapped[float] = mapped_column(Numeric, nullable=False)
    fans_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_streams: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # In-game calendar. Time advances only when the player *does* something
    # (release, train, tour) — never in real time — so a career can be played
    # out in one sitting and idling is never a strategy (GDD anti-pattern:
    # 방치형 루프). services/time_service.py is the only thing that moves this.
    game_date: Mapped[date] = mapped_column(Date, nullable=False, default=GAME_EPOCH)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False, default=GAME_EPOCH)
    # Marks the last game-week/season already settled, so weekly chart and
    # season payouts fire exactly once per period no matter how far a single
    # action jumps the calendar.
    last_settled_week: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_settled_season: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="characters")
    world: Mapped["World"] = relationship()
    songs: Mapped[list["Song"]] = relationship(back_populates="character", cascade="all, delete-orphan")
    loyalty: Mapped[list["CharacterFanLoyalty"]] = relationship(back_populates="character", cascade="all, delete-orphan")

    @property
    def age(self) -> int:
        """Whole years between birth_date and the current in-game date."""
        d, b = self.game_date, self.birth_date
        return d.year - b.year - ((d.month, d.day) < (b.month, b.day))

    @property
    def game_day_index(self) -> int:
        """Days since the shared epoch — the basis for week/season numbering."""
        return (self.game_date - GAME_EPOCH).days
