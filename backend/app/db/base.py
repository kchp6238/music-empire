from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. See docs/db-schema.md for the target Postgres
    schema — models here use SQLAlchemy's generic JSON/String types so the
    same code runs against SQLite (zero-setup local dev) and Postgres
    (docker-compose / Railway / Render) without branching."""
