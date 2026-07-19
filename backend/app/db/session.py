from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings


def normalize_db_url(url: str) -> str:
    """Railway/Heroku hand out `postgres://` or `postgresql://` URLs, but this
    app installs psycopg 3, whose SQLAlchemy dialect is `postgresql+psycopg`.
    Without this the deployed app fails at import with a driver error."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = normalize_db_url(settings.database_url)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    # Managed Postgres drops idle connections; without this the first request
    # after a quiet period fails on a stale pooled connection.
    pool_pre_ping=not DATABASE_URL.startswith("sqlite"),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
