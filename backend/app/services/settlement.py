"""Weekly and season settlement, plus age effects (GDD §4, §14, core-loop §3/§4).

Called from time_service.advance_days(). Because a single action can jump the
calendar past several boundaries, everything here loops from the last settled
period up to the current one, so a 30-day tour settles four weeks rather than
one — and never settles the same period twice.
"""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.company import Company, Trainee
from app.models.season import SeasonRecord
from app.services.js_math import js_round

# Fame fades without new work — the weekly nudge that makes an idle career
# actually cost something.
WEEKLY_FAME_DECAY = 0.4
# Older releases keep earning, but less each week.
CATALOGUE_DECAY_PER_WEEK = 0.97

# Age curve. Physical/performance stats peak early and decline; judgement-type
# stats keep improving. Applied once per season so it's gradual.
AGE_PEAK = 32
DECLINING_STATS = ("vocal",)
MATURING_STATS = ("business", "marketing", "lyrics")
# Experience alone makes you competent, not elite: age stops lifting a stat at
# this point, so the top of the range still has to be trained for. Without the
# cap a long career quietly maxed business/marketing/lyrics for free, which
# both trivialised those stats and rewarded simply letting time pass.
MATURING_SOFT_CAP = 70
# Voice fades with age but a veteran shouldn't end up unable to sing.
DECLINE_FLOOR = 30


def settle_weeks(db: Session, character: Character) -> int:
    """Settle every whole game-week crossed since the last settlement."""
    from app.services.time_service import week_index

    current = week_index(character)
    settled = 0
    while character.last_settled_week < current:
        character.last_settled_week += 1
        settled += 1

        # fame decays a little each week without a release
        character.fame = max(0.0, float(character.fame) - WEEKLY_FAME_DECAY)

        # trainees keep improving on their own while time passes
        _grow_trainees(db, character)

    return settled


def _grow_trainees(db: Session, character: Character) -> None:
    company = db.query(Company).filter(Company.owner_character_id == character.id).first()
    if company is None:
        return
    for t in db.query(Trainee).filter(Trainee.company_id == company.id, Trainee.group_id.is_(None)).all():
        effort = t.talent.get("effort", 50)
        gain = 1 if effort < 70 else 2  # harder workers creep up faster
        t.stats = {k: min(95, v + gain) for k, v in t.stats.items()}


def settle_seasons(db: Session, character: Character) -> list[dict]:
    """Close out every whole season crossed, recording a snapshot each time."""
    from app.services.time_service import season_index, season_label_for_index, DAYS_PER_SEASON
    from app.models.character import GAME_EPOCH
    from datetime import timedelta

    current = season_index(character)
    records = []
    while character.last_settled_season < current:
        # Settle the season that just *completed*, not the one now in progress:
        # last_settled_season is the count already closed, so it doubles as the
        # 0-based index of the next one to close.
        s = character.last_settled_season
        character.last_settled_season += 1
        ended_on = GAME_EPOCH + timedelta(days=(s + 1) * DAYS_PER_SEASON - 1)

        _apply_age_effects(character)

        songs = db.query(Song).filter(
            Song.character_id == character.id, Song.released_at.isnot(None)
        ).all()
        best = max(songs, key=lambda x: float(x.overall_score or 0), default=None)

        rec = SeasonRecord(
            character_id=character.id,
            season_index=s,
            label=season_label_for_index(s),
            ended_on=ended_on,
            age=character.age,
            fame=float(character.fame),
            money=float(character.money),
            fans_count=character.fans_count,
            total_streams=character.total_streams,
            releases_this_season=len(songs),
            best_song=(
                {"title": best.title, "tier": best.tier, "score": float(best.overall_score or 0)}
                if best else None
            ),
        )
        db.add(rec)
        records.append({
            "season_index": s, "label": rec.label, "age": rec.age,
            "fame": rec.fame, "fans_count": rec.fans_count,
        })

    return records


def _apply_age_effects(character: Character) -> None:
    """Nudge stats with age: performance fades past the peak, judgement grows.

    Small per-season steps (±1) so a long career bends the curve without any
    single season feeling arbitrary. Talent is left alone — GDD §4.2 says
    talent is fixed and only skill stats are trainable/decayable.
    """
    age = character.age
    stats = dict(character.stats)

    if age > AGE_PEAK:
        for k in DECLINING_STATS:
            if k in stats:
                stats[k] = max(DECLINE_FLOOR, stats[k] - 1)
    for k in MATURING_STATS:
        # only lifts a stat that's still below the experience ceiling
        if k in stats and stats[k] < MATURING_SOFT_CAP:
            stats[k] = min(MATURING_SOFT_CAP, stats[k] + 1)

    character.stats = stats


def catalogue_income(db: Session, character: Character, weeks: int) -> float:
    """Back-catalogue streaming, decaying with each week that passes."""
    if weeks <= 0:
        return 0.0
    songs = db.query(Song).filter(
        Song.character_id == character.id, Song.released_at.isnot(None)
    ).count()
    if songs == 0:
        return 0.0
    total = 0.0
    for w in range(weeks):
        total += songs * 20 * (CATALOGUE_DECAY_PER_WEEK ** w)
    return js_round(total)
