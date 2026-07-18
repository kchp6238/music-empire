"""Weekly trend rotation (GDD — 유행 장르/트렌드 시스템).

Deterministic from the ISO week number so every player in the same week sees
the same hot genre/mood without any stored state or cron — see
docs/core-loop.md §4. A song whose tags match the current trend gets an
exposure multiplier at release time.
"""

from datetime import datetime, timezone

TREND_GENRES = ["발라드", "팝", "힙합", "R&B", "EDM", "록", "인디", "재즈", "트로트"]
TREND_MOODS = ["감성적", "신남", "우울", "강렬", "로맨틱", "몽환적", "편안함", "실험적"]

TREND_MATCH_MULTIPLIER = 1.25  # exposure bonus when a tag matches the trend


def current_trend(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    year, week, _ = now.isocalendar()
    # two independent rotations offset from each other
    genre = TREND_GENRES[(year * 53 + week) % len(TREND_GENRES)]
    mood = TREND_MOODS[(year * 53 + week * 3) % len(TREND_MOODS)]
    return {"year": year, "week": week, "genre": genre, "mood": mood}


def trend_multiplier(genre_tags: list[str], mood_tags: list[str], now: datetime | None = None) -> float:
    trend = current_trend(now)
    mult = 1.0
    if trend["genre"] in (genre_tags or []):
        mult *= TREND_MATCH_MULTIPLIER
    if trend["mood"] in (mood_tags or []):
        mult *= TREND_MATCH_MULTIPLIER
    return mult
