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


def create_recording(db: Session, character: Character, data: bytes, mime_type: str, title: str, duration_sec: float, song_id: str | None, section: str | None = None, pitch_shift: int | None = None) -> VocalRecording:
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
        section=(section or None), pitch_shift=pitch_shift,
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


def vocal_ids_for_songs(db: Session, song_ids: list[str]) -> dict[str, str]:
    """song_id -> the recording id to play over its beat, for a batch of songs.

    When a song has more than one attached take the newest wins — that's the
    one the player kept. Selects ids only, never the audio bytes, so listing a
    feed of songs stays cheap.
    """
    if not song_ids:
        return {}
    rows = (
        db.query(VocalRecording.id, VocalRecording.song_id, VocalRecording.created_at)
        .filter(VocalRecording.song_id.in_(song_ids))
        .order_by(VocalRecording.created_at.desc())
        .all()
    )
    out: dict[str, str] = {}
    for rec_id, song_id, _ in rows:
        out.setdefault(song_id, rec_id)  # first seen = newest, since ordered desc
    return out


def get_owned(db: Session, recording_id: str, character: Character) -> VocalRecording:
    rec = db.get(VocalRecording, recording_id)
    if rec is None or rec.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="녹음을 찾을 수 없습니다")
    return rec


def attach_to_song(db: Session, rec: VocalRecording, character: Character, song_id: str | None, section: str | None = "__keep__") -> VocalRecording:
    if song_id is not None:
        song = db.get(Song, song_id)
        if song is None or song.character_id != character.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="곡을 찾을 수 없습니다")
    rec.song_id = song_id
    # Detaching clears the section too; the sentinel lets a caller leave section
    # untouched while only changing attachment.
    if section != "__keep__":
        rec.section = section or None
    if song_id is None:
        rec.section = None
    db.commit()
    db.refresh(rec)
    return rec


def section_offsets(song: Song) -> dict[str, float]:
    """Start time in seconds of each section's FIRST appearance in the song, so
    a take tagged to a section can be scheduled to come in at the right moment.
    A section that repeats plays its take at the first occurrence only."""
    sections = song.pattern or {}
    arrangement = song.structure or []
    step_sec = 60.0 / (song.bpm or 100) / 4  # one 16th-note step
    offsets: dict[str, float] = {}
    cum_steps = 0
    for key in arrangement:
        if key not in offsets:
            offsets[key] = cum_steps * step_sec
        sec = sections.get(key) or {}
        length = sec.get("length") or len(sec.get("bass") or []) or 16
        cum_steps += length
    return offsets


def vocals_for_songs(db: Session, song_ids: list[str]) -> dict[str, list[tuple]]:
    """song_id -> [(recording_id, section, pitch_shift), ...] oldest-first, for a
    batch of songs. Ids/metadata only, never the audio bytes."""
    if not song_ids:
        return {}
    rows = (
        db.query(VocalRecording.id, VocalRecording.song_id, VocalRecording.section, VocalRecording.pitch_shift)
        .filter(VocalRecording.song_id.in_(song_ids))
        .order_by(VocalRecording.created_at.asc())
        .all()
    )
    out: dict[str, list[tuple]] = {}
    for rec_id, song_id, section, pitch_shift in rows:
        out.setdefault(song_id, []).append((rec_id, section, pitch_shift))
    return out


def song_vocals(db: Session, song: Song) -> list[dict]:
    """Every take attached to one song, each with the second-offset it enters at
    — the shape the client's layered playback consumes."""
    rows = vocals_for_songs(db, [song.id]).get(song.id, [])
    if not rows:
        return []
    offsets = section_offsets(song)
    return [
        {"recording_id": rid, "section": section, "offset_sec": offsets.get(section, 0.0)}
        for rid, section, _ in rows
    ]


def delete_recording(db: Session, rec: VocalRecording) -> None:
    db.delete(rec)
    db.commit()
