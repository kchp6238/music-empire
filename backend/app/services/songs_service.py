from datetime import datetime, timezone, date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.fan import FanPersona, CharacterFanLoyalty, SongReaction
from app.services.patterns import build_combined_pattern
from app.services import scoring


def get_owned_draft(db: Session, song_id: str, character: Character) -> Song:
    song = db.get(Song, song_id)
    if song is None or song.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")
    return song


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


def _released_today(db: Session, character: Character) -> bool:
    today = date.today()
    return (
        db.query(Song)
        .filter(Song.character_id == character.id, Song.released_at.isnot(None))
        .filter(Song.released_at >= datetime(today.year, today.month, today.day, tzinfo=timezone.utc))
        .first()
        is not None
    )


def release_song(db: Session, song: Song, character: Character) -> dict:
    """Server-side authoritative scoring — see docs/server-architecture.md §3.
    The client's own computeRelease() result is never trusted or accepted here."""
    if song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song already released")
    if _released_today(db, character):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="One release per day per character")

    combined = build_combined_pattern(song.pattern, song.structure)
    fan_personas = [
        {"id": p.id, "genre_pref": p.genre_pref, "mood_pref": p.mood_pref, "openness": float(p.openness)}
        for p in db.query(FanPersona).all()
    ]
    loyalty_rows = db.query(CharacterFanLoyalty).filter(CharacterFanLoyalty.character_id == character.id).all()
    persona_loyalty = {row.persona_id: float(row.loyalty_score) for row in loyalty_rows}

    song_input = {
        "bpm": song.bpm, "genre_tags": song.genre_tags, "mood_tags": song.mood_tags,
        "chord_preset_id": song.chord_preset_id, "production_mode": song.production_mode,
        "vocal_source": song.vocal_source, "structure": song.structure, "lyrics": song.lyrics,
    }
    result = scoring.compute_release(character, song_input, combined, fan_personas, persona_loyalty)

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
    song.released_at = datetime.now(timezone.utc)

    for r in result["persona_results"]:
        db.add(SongReaction(
            song_id=song.id, persona_id=r["persona"]["id"], reached=r["reached"],
            affinity=r["affinity"], reaction_score=r["reaction_score"], comment_line=None,
        ))

    character.fame = max(0, min(100, float(character.fame) + result["fame_delta"]))
    character.money = max(0, float(character.money) + result["money_delta"])
    character.fans_count = max(0, character.fans_count + result["fans_delta"])

    loyalty_by_persona = {row.persona_id: row for row in loyalty_rows}
    for persona_id, score in result["new_loyalty"].items():
        row = loyalty_by_persona.get(persona_id)
        if row:
            row.loyalty_score = score

    db.commit()
    db.refresh(song)

    return {
        "song": song,
        "reactions": db.query(SongReaction).filter(SongReaction.song_id == song.id).all(),
        "character_fame": float(character.fame),
        "character_money": float(character.money),
        "character_fans_count": character.fans_count,
    }
