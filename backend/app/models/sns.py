import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, ForeignKey, Text, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SnsPost(Base):
    """A post in the in-game SNS (뮤즈그램). Authored by the player (character)
    or, deterministically generated, by a rival NPC. `dedupe_key` makes NPC
    generation idempotent so re-fetching the feed never duplicates posts."""

    __tablename__ = "sns_posts"
    __table_args__ = (UniqueConstraint("world_id", "dedupe_key", name="uq_sns_post_dedupe"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    world_id: Mapped[str] = mapped_column(String(36), ForeignKey("worlds.id"), nullable=False, index=True)
    author_type: Mapped[str] = mapped_column(String(10), nullable=False)   # character | npc
    author_id: Mapped[str] = mapped_column(String(36), nullable=False)
    author_name: Mapped[str] = mapped_column(String(120), nullable=False)
    author_color: Mapped[str | None] = mapped_column(String(10), nullable=True)
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_kind: Mapped[str] = mapped_column(String(12), nullable=False, default="glyph")  # cover | glyph
    image_ref: Mapped[str | None] = mapped_column(String(80), nullable=True)  # song_id (cover) or emoji (glyph)
    song_id: Mapped[str | None] = mapped_column(String(36), nullable=True)    # promo target
    likes_base: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # seeded world engagement
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class SnsLike(Base):
    __tablename__ = "sns_likes"

    post_id: Mapped[str] = mapped_column(String(36), ForeignKey("sns_posts.id"), primary_key=True)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class SnsComment(Base):
    __tablename__ = "sns_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id: Mapped[str] = mapped_column(String(36), ForeignKey("sns_posts.id"), nullable=False, index=True)
    author_type: Mapped[str] = mapped_column(String(10), nullable=False)  # character | npc
    author_id: Mapped[str] = mapped_column(String(36), nullable=False)
    author_name: Mapped[str] = mapped_column(String(120), nullable=False)
    author_color: Mapped[str | None] = mapped_column(String(10), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
