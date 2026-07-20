import uuid
from datetime import date

from sqlalchemy import String, Integer, Numeric, Date, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NpcArtist(Base):
    """The rival roster. Global: the same cast exists in every world, but each
    world gets its own discography from them (see NpcSong)."""

    __tablename__ = "npc_artists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str | None] = mapped_column(String(10), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(255), nullable=True)

    songs: Mapped[list["NpcSong"]] = relationship(back_populates="artist", cascade="all, delete-orphan")


class NpcSong(Base):
    """A rival release, belonging to one world.

    Per-world rather than global so each save has its own chart history —
    rivals keep releasing as a career runs, and one save's history must not
    show up in another. Generated deterministically by services/npc_service.py.
    """

    __tablename__ = "npc_songs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    world_id: Mapped[str] = mapped_column(String(36), ForeignKey("worlds.id"), nullable=False, index=True)
    npc_artist_id: Mapped[str] = mapped_column(String(36), ForeignKey("npc_artists.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    tier: Mapped[str] = mapped_column(String(10), nullable=False)
    score: Mapped[float] = mapped_column(Numeric, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    pattern: Mapped[dict] = mapped_column(JSON, nullable=False)
    # In-game release date, so the chart only shows what has come out by the
    # viewer's own date.
    released_on: Mapped[date] = mapped_column(Date, nullable=False)

    artist: Mapped["NpcArtist"] = relationship(back_populates="songs")
