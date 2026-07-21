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
    # Which section of the song this take sings (인트로/벌스/코러스…). Null means
    # the whole song from the top — the original behaviour before per-section
    # takes existed, so old rows keep working unchanged.
    section: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Set on auto-generated harmony takes: the semitone shift applied to a source
    # take. Null for a directly-sung take. Purely informational (the audio is
    # already shifted); lets the UI label a take as a generated harmony line.
    pitch_shift: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    audio_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    duration_sec: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
