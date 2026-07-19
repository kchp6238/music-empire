"""In-game calendar.

Time is advanced *by actions*, never by the wall clock: releasing a song,
training, touring. That keeps a whole career playable in one sitting and means
waiting around is never a strategy (GDD forbids 방치형 idle loops).

`advance_days()` is the only function that moves `character.game_date`. Every
time-driven effect hangs off it, so callers just say how many days their action
costs and get back a summary of everything that happened in between.
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.character import Character

DAYS_PER_WEEK = 7
WEEKS_PER_SEASON = 13          # ~a quarter
DAYS_PER_SEASON = DAYS_PER_WEEK * WEEKS_PER_SEASON

# What each action costs in game days.
ACTION_DAYS = {
    "release": 7,        # a release cycle: press, promo, first week of charting
    "train": 3,          # one focused training block
    "trainee_train": 5,  # coaching a trainee through a curriculum stage
    "recruit": 1,
    "concert": 2,
    "rest": 7,           # deliberate downtime
}


def week_index(character: Character) -> int:
    return character.game_day_index // DAYS_PER_WEEK


def season_index(character: Character) -> int:
    return character.game_day_index // DAYS_PER_SEASON


def season_label_for_index(index: int) -> str:
    """e.g. '2026 Q1' for a given season number, derived from the epoch.

    Takes the index rather than a character so a *completed* season can be
    labelled correctly at settlement time — labelling from the character's
    current date names the season they've already moved into.
    """
    from datetime import timedelta
    from app.models.character import GAME_EPOCH

    start = GAME_EPOCH + timedelta(days=index * DAYS_PER_SEASON)
    return f"{start.year} Q{(index % 4) + 1}"


def season_label(character: Character) -> str:
    """Label of the season the character is currently in."""
    return season_label_for_index(season_index(character))


def advance_days(db: Session, character: Character, days: int, reason: str = "") -> dict:
    """Move the calendar forward and settle everything that falls in the gap.

    Returns a summary the UI can show ("3 days passed, fans +40, ...").
    Commits, because every caller wants the whole advance persisted atomically
    with whatever action triggered it.
    """
    # Imported here rather than at module import time: fan_simulation and the
    # settlement services import Character too, and pulling them in at the top
    # creates an import cycle through models -> services -> models.
    from app.services import fan_simulation, settlement

    days = max(0, int(days))
    if days == 0:
        return {"days": 0, "from_date": character.game_date, "to_date": character.game_date}

    from_date = character.game_date
    character.game_date = from_date + timedelta(days=days)

    # Fans drift and streams accrue over the elapsed days.
    drift = fan_simulation.settle_days(db, character, days)

    # Weekly/season boundaries crossed by this jump, each settled once.
    # Passive money (catalogue royalties) is granted here, not per-day, so
    # actions with no release catalogue behind them earn nothing.
    weekly = settlement.settle_weeks(db, character)
    seasonal = settlement.settle_seasons(db, character)

    db.commit()

    return {
        "days": days,
        "reason": reason,
        "from_date": from_date,
        "to_date": character.game_date,
        "age": character.age,
        "season": season_label(character),
        "fans_delta": drift["fans_delta"],
        "streaming_income": weekly["catalogue_income"],
        "new_streams": drift["new_streams"],
        "weeks_settled": weekly["weeks_settled"],
        "seasons_settled": seasonal,
    }
