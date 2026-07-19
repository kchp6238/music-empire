import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Integer, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VocalRecording(Base):
    """A mic-recorded vocal take (GDD §6 "보컬 직접 녹음").

    Audio bytes live in the row itself rather than on disk: PaaS filesystems
    (Railway/Render/Vercel) are ephemeral, so a disk-backed take would vanish
    on the next deploy. Takes are capped at 10MB and this is a small-group
    game, so the DB comfortably absorbs them — move to object storage if the
    catalogue ever grows past a few GB.

    song_id is nullable so a take can be recorded first and attached later.
    """

    __tablename__ = "vocal_recordings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    song_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("songs.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    audio_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    duration_sec: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
