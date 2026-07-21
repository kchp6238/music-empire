"""Collaboration flow (GDD §10): invite → accept → role/contribution → the
release revenue split in songs_service reads the confirmed collaborators.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.world import World, SOLO
from app.models.collab import CollabInvite, SongCollaborator, COLLAB_ROLES


def invite(db: Session, inviter: Character, song_id: str, invitee_character_id: str, role: str, contribution_pct: float) -> CollabInvite:
    song = db.get(Song, song_id)
    if song is None or song.character_id != inviter.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    if song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite on a released song")
    if role not in COLLAB_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role: {role}")
    if invitee_character_id == inviter.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite yourself")
    # Collaboration is a multiplayer act: there is nobody else in a solo save,
    # and a cross-world invite would split release revenue between economies.
    world = db.get(World, inviter.world_id)
    if world is not None and world.kind == SOLO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="혼자 하는 세이브에서는 협업할 수 없습니다")
    invitee = db.get(Character, invitee_character_id)
    if invitee is None or invitee.world_id != inviter.world_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="같은 세이브의 아티스트가 아닙니다")
    if not (0 < contribution_pct < 100):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="contribution_pct must be between 0 and 100")

    inv = CollabInvite(
        song_id=song_id, inviter_character_id=inviter.id, invitee_character_id=invitee_character_id,
        role=role, contribution_pct=contribution_pct, status="pending",
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def list_incoming(db: Session, character: Character) -> list[dict]:
    rows = (
        db.query(CollabInvite, Song, Character)
        .join(Song, CollabInvite.song_id == Song.id)
        .join(Character, CollabInvite.inviter_character_id == Character.id)
        .filter(CollabInvite.invitee_character_id == character.id, CollabInvite.status == "pending")
        .all()
    )
    return [
        {
            "id": inv.id, "song_id": inv.song_id, "song_title": song.title,
            "inviter_name": inviter.artist_name, "role": inv.role,
            "contribution_pct": float(inv.contribution_pct),
        }
        for inv, song, inviter in rows
    ]


def _ensure_owner_collaborator(db: Session, song: Song):
    owner_row = (
        db.query(SongCollaborator)
        .filter(SongCollaborator.song_id == song.id, SongCollaborator.is_owner == True)  # noqa: E712
        .first()
    )
    if owner_row is None:
        owner_row = SongCollaborator(song_id=song.id, character_id=song.character_id, role="프로듀싱", contribution_pct=100, is_owner=True)
        db.add(owner_row)
        db.flush()
    return owner_row


def respond(db: Session, character: Character, invite_id: str, accept: bool) -> dict:
    inv = db.get(CollabInvite, invite_id)
    if inv is None or inv.invitee_character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    if inv.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already resolved")

    if not accept:
        inv.status = "declined"
        db.commit()
        return {"status": "declined"}

    song = db.get(Song, inv.song_id)
    if song is None or song.released_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Song no longer accepts collaborators")

    owner_row = _ensure_owner_collaborator(db, song)
    db.add(SongCollaborator(
        song_id=song.id, character_id=character.id, role=inv.role,
        contribution_pct=float(inv.contribution_pct), is_owner=False,
    ))
    inv.status = "accepted"
    db.flush()

    # owner keeps the remainder after all non-owner shares
    non_owner_total = (
        db.query(SongCollaborator)
        .filter(SongCollaborator.song_id == song.id, SongCollaborator.is_owner == False)  # noqa: E712
        .all()
    )
    total = sum(float(c.contribution_pct) for c in non_owner_total)
    owner_row.contribution_pct = max(0, 100 - total)

    db.commit()
    return {"status": "accepted"}


def list_for_song(db: Session, song_id: str) -> list[dict]:
    rows = (
        db.query(SongCollaborator, Character)
        .join(Character, SongCollaborator.character_id == Character.id)
        .filter(SongCollaborator.song_id == song_id)
        .all()
    )
    return [
        {"character_id": c.character_id, "artist_name": ch.artist_name, "role": c.role,
         "contribution_pct": float(c.contribution_pct), "is_owner": c.is_owner}
        for c, ch in rows
    ]


def list_mine(db: Session, character: Character) -> list[dict]:
    """Every song this character is a confirmed collaborator on (as owner or
    invited artist) — the "공동 작업" list an invitee lands on after accepting,
    since a solo song never gets a SongCollaborator row in the first place."""
    my_rows = (
        db.query(SongCollaborator, Song)
        .join(Song, SongCollaborator.song_id == Song.id)
        .filter(SongCollaborator.character_id == character.id)
        .all()
    )
    if not my_rows:
        return []

    song_ids = [song.id for _, song in my_rows]
    all_rows = (
        db.query(SongCollaborator, Character)
        .join(Character, SongCollaborator.character_id == Character.id)
        .filter(SongCollaborator.song_id.in_(song_ids))
        .all()
    )
    by_song: dict[str, list[dict]] = {}
    for c, ch in all_rows:
        by_song.setdefault(c.song_id, []).append({
            "character_id": c.character_id, "artist_name": ch.artist_name, "role": c.role,
            "contribution_pct": float(c.contribution_pct), "is_owner": c.is_owner,
        })

    return [
        {
            "song_id": song.id, "title": song.title, "is_owner": my_row.is_owner,
            "my_role": my_row.role, "my_contribution_pct": float(my_row.contribution_pct),
            "released": song.released_at is not None, "tier": song.tier,
            "overall_score": float(song.overall_score) if song.overall_score is not None else None,
            "collaborators": by_song.get(song.id, []),
        }
        for my_row, song in my_rows
    ]


def get_song_for_collaborator(db: Session, character: Character, song_id: str) -> Song:
    """A collaborator (owner or invited) can view the shared song even though
    only the owner can edit or release it — this is the "come see the song"
    step that was previously entirely missing after accepting an invite."""
    is_collaborator = (
        db.query(SongCollaborator)
        .filter(SongCollaborator.song_id == song_id, SongCollaborator.character_id == character.id)
        .first()
    )
    if is_collaborator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")
    song = db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")
    # So the preview here layers the attached vocal over the beat, like everywhere else.
    from app.services import songs_service
    songs_service._attach_vocal_ids(db, [song])
    return song
