"""Creating, joining and listing saves."""

import random
import string

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.world import World, SOLO, MULTI

# No 0/O/1/I — codes get read aloud and typed from memory.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_WORLDS_PER_USER = 12


def _new_join_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(random.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if db.query(World).filter(World.join_code == code).first() is None:
            return code
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="참여 코드를 만들지 못했습니다. 다시 시도해 주세요.")


def create_world(db: Session, user_id: str, name: str, kind: str) -> World:
    if kind not in (SOLO, MULTI):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="세이브 종류가 올바르지 않습니다")
    if db.query(World).filter(World.owner_user_id == user_id).count() >= MAX_WORLDS_PER_USER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="세이브가 너무 많습니다. 쓰지 않는 세이브를 지워주세요.")

    world = World(
        name=(name or "").strip() or ("나의 커리어" if kind == SOLO else "새 멀티 월드"),
        kind=kind,
        owner_user_id=user_id,
        # Solo worlds have no code: nobody else can enter, so there's nothing
        # to share.
        join_code=None if kind == SOLO else _new_join_code(db),
    )
    db.add(world)
    db.commit()
    db.refresh(world)

    # A fresh save needs a chart to climb: give its rivals a back-catalogue so
    # the community isn't empty the moment the player walks in.
    from app.services import npc_service
    npc_service.seed_world(db, world)
    return world


def join_by_code(db: Session, code: str) -> World:
    world = db.query(World).filter(World.join_code == (code or "").strip().upper()).first()
    if world is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="그런 참여 코드가 없습니다")
    if world.kind != MULTI:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="혼자 하는 세이브에는 참여할 수 없습니다")
    return world


def get_for_user(db: Session, world_id: str, user_id: str) -> World:
    """A world the player may enter: their own, or a multi world anyone can join."""
    world = db.get(World, world_id)
    if world is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세이브를 찾을 수 없습니다")
    if world.kind == SOLO and world.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세이브를 찾을 수 없습니다")
    return world


def list_saves(db: Session, user_id: str) -> list[dict]:
    """The save-select screen: every world this player has a career in, plus
    any solo world they made but haven't started yet."""
    characters = db.query(Character).filter(Character.user_id == user_id).all()
    by_world = {c.world_id: c for c in characters}

    owned = db.query(World).filter(World.owner_user_id == user_id).all()
    worlds = {w.id: w for w in owned}
    for c in characters:
        if c.world_id not in worlds:
            w = db.get(World, c.world_id)
            if w is not None:
                worlds[w.id] = w

    saves = []
    for world in worlds.values():
        character = by_world.get(world.id)
        released = 0
        if character is not None:
            released = (
                db.query(Song)
                .filter(Song.character_id == character.id, Song.released_at.isnot(None))
                .count()
            )
        players = db.query(Character).filter(Character.world_id == world.id).count()
        saves.append({
            "world_id": world.id,
            "name": world.name,
            "kind": world.kind,
            "join_code": world.join_code,
            "is_owner": world.owner_user_id == user_id,
            "player_count": players,
            "created_at": world.created_at,
            # None when the world exists but this player hasn't made a career
            # in it yet — the UI sends them to character creation.
            "character": None if character is None else {
                "id": character.id,
                "artist_name": character.artist_name,
                "background_name": character.background_name,
                "game_date": character.game_date,
                "age": character.age,
                "fame": float(character.fame),
                "money": float(character.money),
                "fans_count": character.fans_count,
                "released_count": released,
            },
        })
    saves.sort(key=lambda s: s["created_at"], reverse=True)
    return saves


def delete_world(db: Session, world_id: str, user_id: str) -> None:
    world = db.get(World, world_id)
    if world is None or world.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세이브를 찾을 수 없습니다")
    if world.kind == MULTI and db.query(Character).filter(Character.world_id == world_id).count() > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="다른 사람이 함께 하고 있는 월드는 지울 수 없습니다",
        )
    db.delete(world)
    db.commit()
