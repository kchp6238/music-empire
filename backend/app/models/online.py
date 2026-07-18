import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Concert(Base):
    """A scheduled concert event (GDD §11). Other characters can buy tickets
    (register attendance) up until the scheduled time."""

    __tablename__ = "concerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    host_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    venue_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    ticket_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    tickets: Mapped[list["ConcertTicket"]] = relationship(back_populates="concert", cascade="all, delete-orphan")


class ConcertTicket(Base):
    __tablename__ = "concert_tickets"

    concert_id: Mapped[str] = mapped_column(String(36), ForeignKey("concerts.id"), primary_key=True)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), primary_key=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    concert: Mapped["Concert"] = relationship(back_populates="tickets")


class MarketplaceListing(Base):
    """A released song offered for sale/licensing to other characters
    (GDD §11 곡 거래 마켓플레이스)."""

    __tablename__ = "marketplace_listings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_id: Mapped[str] = mapped_column(String(36), ForeignKey("songs.id"), nullable=False, index=True)
    seller_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="open")  # open | sold
    buyer_character_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("characters.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    sold_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
