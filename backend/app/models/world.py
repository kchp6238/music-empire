import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SOLO = "solo"
MULTI = "multi"


class World(Base):
    """One save — a self-contained music scene.

    A solo world is private to its owner: the charts hold only their songs and
    the NPC rivals. A multi world is shared, joined with a code, and everyone
    in it competes on the same charts. Nothing crosses between worlds: not
    songs, not follows, not money.

    Modelled as its own table rather than a `mode` flag on Character because a
    player can hold several saves at once (the FM shape the game is going for),
    and because everything cross-player needs something to be scoped *by*.
    """

    __tablename__ = "worlds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default=SOLO)  # solo | multi
    # Who made it. For a solo world this is also the only user who may enter.
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    # Multi worlds only — the code friends type to join. Unique so a code
    # identifies exactly one world; NULL for solo saves.
    join_code: Mapped[str | None] = mapped_column(String(12), nullable=True, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def is_solo(self) -> bool:
        return self.kind == SOLO
