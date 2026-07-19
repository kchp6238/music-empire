from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./music_empire.db"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 30
    cors_origins: str = "http://localhost:5173"

    # Where uploaded vocal takes are written (gitignored). Only metadata and
    # the generated filename go in the DB — see models/recording.py.
    upload_dir: str = "./uploads"
    max_recording_bytes: int = 10 * 1024 * 1024  # 10MB per take

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
