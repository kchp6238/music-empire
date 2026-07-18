import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    artist_name: Mapped[str] = mapped_column(String(120), nullable=False)
    background_id: Mapped[str] = mapped_column(String(40), nullable=False)
    background_name: Mapped[str] = mapped_column(String(120), nullable=False)
    stats: Mapped[dict] = mapped_column(JSON, nullable=False)
    talent: Mapped[dict] = mapped_column(JSON, nullable=False)
    fame: Mapped[float] = mapped_column(Numeric, nullable=False)
    money: Mapped[float] = mapped_column(Numeric, nullable=False)
    fans_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="character")
    songs: Mapped[list["Song"]] = relationship(back_populates="character", cascade="all, delete-orphan")
    loyalty: Mapped[list["CharacterFanLoyalty"]] = relationship(back_populates="character", cascade="all, delete-orphan")
