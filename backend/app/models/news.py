import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, Text, Date, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NewsItem(Base):
    """A dated bit of in-world news for one character's timeline (GDD "매일의
    소식"). Most are flavor (fun/serious/industry/rival/personal); some are
    `choice` events whose `choices` the player resolves, applying effects to
    money/fans/fame. Generated deterministically per (character, date) so the
    same day always yields the same news.
    """

    __tablename__ = "news_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), nullable=False, index=True)
    game_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # fun|serious|industry|rival|personal|choice
    icon: Mapped[str] = mapped_column(String(8), nullable=False, default="📰")
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # choice events only: [{id, label, money, fans, fame, outcome}]
    choices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    chosen_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
