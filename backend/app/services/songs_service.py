from datetime import datetime, timezone, date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.fan import FanPersona, CharacterFanLoyalty, SongReaction
from app.models.collab import SongCollaborator
from app.services.patterns import build_combined_pattern
from app.services import scoring, economy, achievements, time_service, reactions
from app.services.trends import trend_multiplier


def list_released(db: Session, character: Character) -> list[Song]:
    songs = (
        db.query(Song)
        .filter(Song.character_id == character.id, Song.released_at.isnot(None))
        .order_by(Song.released_at.desc())
        .all()
    )
    _attach_vocal_ids(db, songs)
    return songs


def _attach_vocal_ids(db: Session, songs: list[Song]) -> None:
    """Stamp each song with its attached vocal takes, so SongOut can expose them
    and playback can layer each voice over the beat at its section's offset.

    `vocals` is the full per-section list (harmony stacks and all); the legacy
    `vocal_recording_id` (newest single take) is kept for older callers.
    """
    from app.services import recordings_service
    by_song = recordings_service.vocals_for_songs(db, [s.id for s in songs])
    for s in songs:
        rows = by_song.get(s.id, [])
        offsets = recordings_service.section_offsets(s)
        s.vocals = [
            {"recording_id": rid, "section": section, "offset_sec": offsets.get(section, 0.0)}
            for rid, section, _ in rows
        ]
        # rows are oldest-first, so the last is the newest take.
        s.vocal_recording_id = rows[-1][0] if rows else None


def list_drafts(db: Session, character: Character) -> list[Song]:
    """Unreleased works-in-progress, newest first — backs the editor's
    save/load flow so a song survives leaving the page."""
    return (
        db.query(Song)
        .filter(Song.character_id == character.id, Song.released_at.is_(None))
        .order_by(Song.updated_at.desc())
        .all()
    )


def get_owned_draft(db: Session, song_id: str, character: Character) -> Song:
    song = db.get(Song, song_id)
    if song is None or song.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")
    return song


def delete_draft(db: Session, song: Song) -> None:
    if song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="발매된 곡은 삭제할 수 없습니다")
    db.delete(song)
    db.commit()


def create_draft(db: Session, character: Character, data: dict) -> Song:
    song = Song(character_id=character.id, **data)
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


def update_draft(db: Session, song: Song, data: dict) -> Song:
    if song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song already released")
    for field, value in data.items():
        if value is not None:
            setattr(song, field, value)
    db.commit()
    db.refresh(song)
    return song


def release_song(db: Session, song: Song, character: Character) -> dict:
    """Server-side authoritative scoring — see docs/server-architecture.md §3.
    The client's own computeRelease() result is never trusted or accepted here.

    Releasing costs a week of game time (time_service.ACTION_DAYS), which
    replaces the old one-release-per-real-day throttle: spacing between
    releases is now a property of the in-game calendar rather than a rule.
    """
    if song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song already released")

    combined = build_combined_pattern(song.pattern, song.structure)
    # name/color ride along because services/reactions.py needs the persona's
    # identity to pick a speech register — scoring itself ignores them.
    fan_personas = [
        {"id": p.id, "name": p.name, "color": p.color,
         "genre_pref": p.genre_pref, "mood_pref": p.mood_pref, "openness": float(p.openness)}
        for p in db.query(FanPersona).all()
    ]
    loyalty_rows = db.query(CharacterFanLoyalty).filter(CharacterFanLoyalty.character_id == character.id).all()
    persona_loyalty = {row.persona_id: float(row.loyalty_score) for row in loyalty_rows}

    song_input = {
        "bpm": song.bpm, "genre_tags": song.genre_tags, "mood_tags": song.mood_tags,
        "chord_preset_id": song.chord_preset_id, "production_mode": song.production_mode,
        "vocal_source": song.vocal_source, "structure": song.structure, "lyrics": song.lyrics,
    }
    # Scored against the trend on the release date, before the calendar moves.
    tmult = trend_multiplier(song.genre_tags, song.mood_tags, character.game_date)
    result = scoring.compute_release(character, song_input, combined, fan_personas, persona_loyalty, trend_multiplier=tmult)

    breakdown_money = economy.compute_revenue_breakdown(
        result["overall_score"], character.fame, character.fans_count,
        song.vocal_source, song.production_mode == "expert", result["money_delta"],
    )

    song.craft = result["attributes"]["craft"]
    song.originality = result["attributes"]["originality"]
    song.accessibility = result["attributes"]["accessibility"]
    song.experimental = result["attributes"]["experimental"]
    song.overall_score = result["overall_score"]
    song.tier = result["tier"]
    song.genius_event = result["genius_event"]
    song.sleeper_hit = result["sleeper_hit"]
    song.fans_delta = result["fans_delta"]
    song.money_delta = result["money_delta"]
    song.fame_delta = result["fame_delta"]
    song.revenue_breakdown = breakdown_money
    song.released_at = datetime.now(timezone.utc)
    song.released_on = character.game_date

    # Comments are written once, here — not invented at render time — so the
    # results screen and the feed quote the same fan saying the same thing.
    comments = reactions.build_for_reactions(
        {p["id"]: p for p in fan_personas}, result["persona_results"],
        song_input, result, persona_loyalty, song.id,
    )
    for r in result["persona_results"]:
        pid = r["persona"]["id"]
        db.add(SongReaction(
            song_id=song.id, persona_id=pid, reached=r["reached"],
            affinity=r["affinity"], reaction_score=r["reaction_score"],
            comment_line=comments.get(pid),
        ))

    character.fame = max(0, min(100, float(character.fame) + result["fame_delta"]))
    character.fans_count = max(0, character.fans_count + result["fans_delta"])

    # Revenue split (GDD §10): if this song has confirmed collaborators, split
    # money_delta by contribution %; otherwise the owner keeps it all.
    collaborators = db.query(SongCollaborator).filter(SongCollaborator.song_id == song.id).all()
    if collaborators:
        for collab in collaborators:
            share = round(result["money_delta"] * float(collab.contribution_pct) / 100)
            collab.character.money = max(0, float(collab.character.money) + share)
    else:
        character.money = max(0, float(character.money) + result["money_delta"])

    loyalty_by_persona = {row.persona_id: row for row in loyalty_rows}
    for persona_id, score in result["new_loyalty"].items():
        row = loyalty_by_persona.get(persona_id)
        if row:
            row.loyalty_score = score

    db.commit()
    db.refresh(song)
    _attach_vocal_ids(db, [song])  # so the results screen can play the take with the beat

    # A release eats a week of calendar: fans drift, the trend may rotate, and
    # any week/season boundary crossed gets settled. Runs after the release is
    # committed so the new song counts toward the period it was released in.
    time_summary = time_service.advance_days(db, character, time_service.ACTION_DAYS["release"], reason="release")

    newly_unlocked = achievements.check_and_unlock(db, character)

    return {
        "song": song,
        "reactions": db.query(SongReaction).filter(SongReaction.song_id == song.id).all(),
        "breakdown": result["breakdown"],
        "revenue_breakdown": breakdown_money,
        "newly_unlocked": newly_unlocked,
        "time": time_summary,
        "character_fame": float(character.fame),
        "character_money": float(character.money),
        "character_fans_count": character.fans_count,
        "character_age": character.age,
        "character_game_date": character.game_date,
    }
