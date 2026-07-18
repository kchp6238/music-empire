import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Roles a collaborator can take on a song — GDD §10.
COLLAB_ROLES = ["작곡", "작사", "편곡", "보컬", "프로듀싱"]


class CollabInvite(Base):
    """An invitation from one character to another to co-work on a draft song.
    status: pending | accepted | declined. See GDD §10 / docs/collaboration.md."""

    __tablename__ = "collab_invites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_id: Mapped[str] = mapped_column(String(36), ForeignKey("songs.id"), nullable=False, index=True)
    inviter_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False)
    invitee_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    contribution_pct: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class SongCollaborator(Base):
    """A confirmed collaborator on a song, with the contribution share used to
    split release revenue (GDD §10)."""

    __tablename__ = "song_collaborators"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_id: Mapped[str] = mapped_column(String(36), ForeignKey("songs.id"), nullable=False, index=True)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    contribution_pct: Mapped[float] = mapped_column(Numeric, nullable=False)
    is_owner: Mapped[bool] = mapped_column(default=False)

    character: Mapped["Character"] = relationship()
