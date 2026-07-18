"""Collaboration flow (GDD §10): invite → accept → role/contribution → the
release revenue split in songs_service reads the confirmed collaborators.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
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
    if db.get(Character, invitee_character_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitee not found")
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
