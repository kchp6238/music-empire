"""Vocal take storage (GDD §6 보컬 직접 녹음).

Audio bytes are stored in the DB row (see models/recording.py for why) and
served back through an authenticated endpoint — takes are private to the
character that recorded them.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.character import Character
from app.models.song import Song
from app.models.recording import VocalRecording

ALLOWED_MIME_PREFIX = "audio/"


def create_recording(db: Session, character: Character, data: bytes, mime_type: str, title: str, duration_sec: float, song_id: str | None) -> VocalRecording:
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 녹음 파일입니다")
    if len(data) > settings.max_recording_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="녹음 파일이 너무 큽니다 (최대 10MB)")

    base_mime = (mime_type or "").split(";")[0].strip().lower()
    if not base_mime.startswith(ALLOWED_MIME_PREFIX):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"오디오 파일만 업로드할 수 있습니다 ({base_mime or 'unknown'})")

    if song_id is not None:
        song = db.get(Song, song_id)
        if song is None or song.character_id != character.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="곡을 찾을 수 없습니다")

    # Per-character quota: uploads are unauthenticated-ish in the sense that
    # any registered player can post takes, so cap total stored bytes.
    used = sum(r.size_bytes for r in db.query(VocalRecording).filter(VocalRecording.character_id == character.id).all())
    if used + len(data) > settings.max_recording_bytes_per_character:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="녹음 저장 용량을 초과했습니다. 오래된 테이크를 삭제해 주세요.",
        )

    rec = VocalRecording(
        character_id=character.id, song_id=song_id,
        title=(title or "").strip() or "무제 테이크",
        audio_data=data, mime_type=base_mime,
        duration_sec=max(0.0, float(duration_sec or 0)), size_bytes=len(data),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def list_for_character(db: Session, character: Character, song_id: str | None = None) -> list[VocalRecording]:
    # Deliberately selects full rows including audio_data; take counts per
    # player are small. Switch to a column subset if listing ever gets heavy.
    q = db.query(VocalRecording).filter(VocalRecording.character_id == character.id)
    if song_id is not None:
        q = q.filter(VocalRecording.song_id == song_id)
    return q.order_by(VocalRecording.created_at.desc()).all()


def get_owned(db: Session, recording_id: str, character: Character) -> VocalRecording:
    rec = db.get(VocalRecording, recording_id)
    if rec is None or rec.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="녹음을 찾을 수 없습니다")
    return rec


def attach_to_song(db: Session, rec: VocalRecording, character: Character, song_id: str | None) -> VocalRecording:
    if song_id is not None:
        song = db.get(Song, song_id)
        if song is None or song.character_id != character.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="곡을 찾을 수 없습니다")
    rec.song_id = song_id
    db.commit()
    db.refresh(rec)
    return rec


def delete_recording(db: Session, rec: VocalRecording) -> None:
    db.delete(rec)
    db.commit()
