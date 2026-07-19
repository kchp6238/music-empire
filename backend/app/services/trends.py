"""Weekly trend rotation (GDD — 유행 장르/트렌드 시스템).

Keyed off the *in-game* week (days since GAME_EPOCH / 7), not the wall clock:
time only moves when a player acts, so a trend that rotated in real time would
drift out from under a career being played in one sitting. Deterministic from
the week number, so it needs no stored state or cron and every player at the
same in-game week sees the same trend.
"""

from datetime import date

from app.models.character import GAME_EPOCH

TREND_GENRES = ["발라드", "팝", "힙합", "R&B", "EDM", "록", "인디", "재즈", "트로트"]
TREND_MOODS = ["감성적", "신남", "우울", "강렬", "로맨틱", "몽환적", "편안함", "실험적"]

TREND_MATCH_MULTIPLIER = 1.25  # exposure bonus when a tag matches the trend


def trend_for_date(game_date: date) -> dict:
    week = max(0, (game_date - GAME_EPOCH).days) // 7
    # two independent rotations, offset so genre and mood don't move in lockstep
    genre = TREND_GENRES[week % len(TREND_GENRES)]
    mood = TREND_MOODS[(week * 3) % len(TREND_MOODS)]
    return {"week": week, "date": game_date, "genre": genre, "mood": mood}


def trend_multiplier(genre_tags: list[str], mood_tags: list[str], game_date: date) -> float:
    trend = trend_for_date(game_date)
    mult = 1.0
    if trend["genre"] in (genre_tags or []):
        mult *= TREND_MATCH_MULTIPLIER
    if trend["mood"] in (mood_tags or []):
        mult *= TREND_MATCH_MULTIPLIER
    return mult
