from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./music_empire.db"
    jwt_secret: str = "change-me-in-production"
    # Long-lived on purpose: this is a single-player-ish game, and a 30-minute
    # token silently expired mid-session (a take would record fine, then the
    # next action failed with a raw 401). The frontend also handles 401 by
    # sending the player back to login rather than showing a dead screen.
    jwt_expire_minutes: int = 60 * 24 * 14  # 14 days
    cors_origins: str = "http://localhost:5173"

    # Where uploaded vocal takes are written (gitignored). Only metadata and
    # the generated filename go in the DB — see models/recording.py.
    upload_dir: str = "./uploads"
    max_recording_bytes: int = 10 * 1024 * 1024  # 10MB per take

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
