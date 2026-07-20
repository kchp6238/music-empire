import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SongCover(Base):
    """Album art for a song, drawn in-game (GDD §6 — player-authored release
    artwork).

    Its own table rather than columns on `songs` precisely so the image bytes
    never ride along with a song query: the feed, the chart and the release
    history all select whole Song rows, and dragging a few hundred KB of PNG
    through each of those would be a real cost for a column almost none of
    them read. Cover bytes are only ever fetched through the dedicated
    endpoint, one song at a time.

    Storage follows VocalRecording's reasoning — bytes in the row because PaaS
    filesystems are ephemeral. One cover per song, so song_id is unique.
    """

    __tablename__ = "song_covers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_id: Mapped[str] = mapped_column(String(36), ForeignKey("songs.id"), nullable=False, unique=True, index=True)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    image_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
