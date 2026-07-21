import random

from sqlalchemy.orm import Session

from app.models.character import Character, GAME_EPOCH
from app.models.fan import FanPersona, CharacterFanLoyalty
from app.services.game_data import BACKGROUNDS, BACKGROUNDS_BY_ID
from app.services.js_math import js_round


def _jitter(obj: dict, lo: float, hi: float, floor: float, ceil: float) -> dict:
    return {k: js_round(max(floor, min(ceil, v + random.uniform(lo, hi)))) for k, v in obj.items()}


def resolve_background(background_id: str) -> dict:
    if background_id != "random":
        return BACKGROUNDS_BY_ID[background_id]
    base = random.choice(BACKGROUNDS)
    return {
        "id": "random",
        "name": f"랜덤 인생 ({base['name']} 기반)",
        "stats": _jitter(base["stats"], -15, 15, 5, 95),
        "talent": _jitter(base["talent"], -15, 15, 5, 95),
        "fame": js_round(max(0, min(100, base["fame"] + random.uniform(-10, 10)))),
        "money": js_round(max(100, min(50000, base["money"] + random.uniform(-300, 300)))),
        "start_age": max(16, base.get("start_age", 22) + random.randint(-3, 3)),
    }


def create_character(db: Session, user_id: str, artist_name: str, background_id: str, world_id: str) -> Character:
    resolved = resolve_background(background_id)
    start_age = resolved.get("start_age", 22)
    character = Character(
        user_id=user_id,
        world_id=world_id,
        artist_name=artist_name.strip() or "무명",
        background_id=resolved["id"],
        background_name=resolved["name"],
        stats=dict(resolved["stats"]),
        talent=dict(resolved["talent"]),
        fame=resolved["fame"],
        money=resolved["money"],
        fans_count=js_round(resolved["fame"] * 8 + 30),
        # Everyone starts on the shared epoch; backdating the birthday is what
        # gives each background its starting age. Subtracting years directly
        # rather than start_age*365 — leap days otherwise push the birthday
        # past the epoch and the character starts a year younger than intended.
        game_date=GAME_EPOCH,
        birth_date=GAME_EPOCH.replace(year=GAME_EPOCH.year - start_age),
    )
    db.add(character)
    db.flush()

    for persona in db.query(FanPersona).all():
        db.add(CharacterFanLoyalty(character_id=character.id, persona_id=persona.id, loyalty_score=0))

    db.commit()
    db.refresh(character)
    return character


def list_for_user(db: Session, user_id: str) -> list[Character]:
    """Every save this player holds, newest first."""
    return (
        db.query(Character)
        .filter(Character.user_id == user_id)
        .order_by(Character.created_at.desc())
        .all()
    )


def get_by_user(db: Session, user_id: str) -> Character | None:
    """The player's sole character, or None when they have none — or several.

    Only meaningful as a fallback for clients that predate save selection; with
    more than one save there is no "the" character and the caller must say
    which. See routers/songs.py::get_current_character.
    """
    rows = db.query(Character).filter(Character.user_id == user_id).limit(2).all()
    return rows[0] if len(rows) == 1 else None


def get_owned(db: Session, character_id: str, user_id: str) -> Character | None:
    return (
        db.query(Character)
        .filter(Character.id == character_id, Character.user_id == user_id)
        .first()
    )


def get_in_world(db: Session, user_id: str, world_id: str) -> Character | None:
    return (
        db.query(Character)
        .filter(Character.user_id == user_id, Character.world_id == world_id)
        .first()
    )
