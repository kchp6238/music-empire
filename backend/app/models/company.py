import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

COMPANY_ROLES = ["대표", "가수", "프로듀서", "작곡가"]


class Company(Base):
    """A label founded by a character (GDD §12). Meta-layer over the solo
    systems — trainees train up and debut into groups."""

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    capital: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    founded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    trainees: Mapped[list["Trainee"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    groups: Mapped[list["Group"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Trainee(Base):
    """A recruited trainee that trains up over curriculum stages, then debuts
    into a group (GDD §12)."""

    __tablename__ = "trainees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    stats: Mapped[dict] = mapped_column(JSON, nullable=False)
    talent: Mapped[dict] = mapped_column(JSON, nullable=False)
    curriculum_stage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    group_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    company: Mapped["Company"] = relationship(back_populates="trainees")
    group: Mapped["Group | None"] = relationship(back_populates="members")


class Group(Base):
    """A debuted group formed from trainees (GDD §12)."""

    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    fame: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    fans_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    debuted_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    company: Mapped["Company"] = relationship(back_populates="groups")
    members: Mapped[list["Trainee"]] = relationship(back_populates="group")
