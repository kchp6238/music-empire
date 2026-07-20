from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./music_empire.db"
    jwt_secret: str = DEFAULT_JWT_SECRET
    # Long-lived on purpose: this is a single-player-ish game, and a 30-minute
    # token silently expired mid-session (a take would record fine, then the
    # next action failed with a raw 401). The frontend also handles 401 by
    # sending the player back to login rather than showing a dead screen.
    jwt_expire_minutes: int = 60 * 24 * 14  # 14 days
    cors_origins: str = "http://localhost:5173"

    # Set to "production" on the deployed backend. Enables the start-up
    # refusal below so the public instance can't run on the sample secret.
    environment: str = "development"

    # Comma-separated invite codes. When non-empty, registration requires one.
    # Rotate by changing the env var — codes aren't stored per-user.
    invite_codes: str = ""

    max_recording_bytes: int = 10 * 1024 * 1024        # 10MB per take
    max_recording_bytes_per_character: int = 200 * 1024 * 1024  # 200MB per player
    # Covers are canvas PNGs at 640px — a few hundred KB in practice. The cap
    # is generous headroom, not an expected size.
    max_cover_bytes: int = 3 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def invite_code_set(self) -> set[str]:
        return {c.strip() for c in self.invite_codes.split(",") if c.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"


settings = Settings()

# Refuse to boot a production instance on the published sample secret —
# anyone reading the repo could otherwise forge a token for any account.
# Fails fast at import so a misconfigured deploy never serves traffic.
if settings.is_production and settings.jwt_secret == DEFAULT_JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is still the sample value. Set a real random secret "
        "(e.g. `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`) "
        "before running with ENVIRONMENT=production."
    )
