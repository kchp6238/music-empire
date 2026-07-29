import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, ForeignKey, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DmMessage(Base):
    """One message in the phone's 메시지 app. Every message belongs to a thread
    (`thread_key`: 'label' for the agency, or 'npc:<id>' for a rival) and to a
    single player's inbox. Generated messages carry a `dedupe_key` so the
    deterministic catch-up never doubles them; player replies have none."""

    __tablename__ = "dm_messages"
    __table_args__ = (UniqueConstraint("character_id", "dedupe_key", name="uq_dm_dedupe"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    world_id: Mapped[str] = mapped_column(String(36), ForeignKey("worlds.id"), nullable=False, index=True)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    thread_key: Mapped[str] = mapped_column(String(48), nullable=False)
    thread_name: Mapped[str] = mapped_column(String(120), nullable=False)
    thread_color: Mapped[str | None] = mapped_column(String(10), nullable=True)
    from_me: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    read_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
