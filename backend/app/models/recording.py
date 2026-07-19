import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VocalRecording(Base):
    """A mic-recorded vocal take (GDD §6 "보컬 직접 녹음").

    The audio itself lives on disk under settings.upload_dir; only metadata
    and the stored filename are in the DB. song_id is nullable so a take can
    be recorded first and attached to a draft later.
    """

    __tablename__ = "vocal_recordings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    song_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("songs.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    duration_sec: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
