"""Album cover storage.

Image bytes live in their own table (see models/cover.py for why) and are
served through an authenticated endpoint. Unlike vocal takes, covers are meant
to be seen by other players, so reads are allowed on any song — only writes
are restricted to the song's owner.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.character import Character
from app.models.song import Song
from app.models.cover import SongCover

ALLOWED_MIME_PREFIX = "image/"


def _owned_song(db: Session, song_id: str, character: Character) -> Song:
    song = db.get(Song, song_id)
    if song is None or song.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="곡을 찾을 수 없습니다")
    return song


def upsert_cover(db: Session, character: Character, song_id: str, data: bytes, mime_type: str) -> SongCover:
    """Save (or replace) a song's cover. One per song, so a re-save overwrites
    rather than piling up rows."""
    _owned_song(db, song_id, character)

    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 이미지입니다")
    if len(data) > settings.max_cover_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="이미지가 너무 큽니다 (최대 3MB)")

    base_mime = (mime_type or "").split(";")[0].strip().lower()
    if not base_mime.startswith(ALLOWED_MIME_PREFIX):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"이미지 파일만 올릴 수 있습니다 ({base_mime or 'unknown'})")

    cover = db.query(SongCover).filter(SongCover.song_id == song_id).first()
    if cover is None:
        cover = SongCover(song_id=song_id, character_id=character.id)
        db.add(cover)
    cover.image_data = data
    cover.mime_type = base_mime
    cover.size_bytes = len(data)
    db.commit()
    db.refresh(cover)
    return cover


def get_cover(db: Session, song_id: str) -> SongCover:
    """Readable by anyone signed in — covers show up in the feed and chart."""
    cover = db.query(SongCover).filter(SongCover.song_id == song_id).first()
    if cover is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="커버가 없습니다")
    return cover


def song_ids_with_cover(db: Session, song_ids: list[str]) -> set[str]:
    """Which of these songs have art — lets list endpoints flag a thumbnail
    without loading a single byte of image data."""
    if not song_ids:
        return set()
    rows = db.query(SongCover.song_id).filter(SongCover.song_id.in_(song_ids)).all()
    return {r[0] for r in rows}


def song_ids_for_character(db: Session, character: Character) -> set[str]:
    rows = db.query(SongCover.song_id).filter(SongCover.character_id == character.id).all()
    return {r[0] for r in rows}


def delete_cover(db: Session, character: Character, song_id: str) -> None:
    _owned_song(db, song_id, character)
    cover = db.query(SongCover).filter(SongCover.song_id == song_id).first()
    if cover is not None:
        db.delete(cover)
        db.commit()
