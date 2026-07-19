from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import recordings_service

router = APIRouter(prefix="/recordings", tags=["recordings"])


def _out(rec) -> dict:
    return {
        "id": rec.id, "title": rec.title, "song_id": rec.song_id,
        "mime_type": rec.mime_type, "duration_sec": float(rec.duration_sec),
        "size_bytes": rec.size_bytes, "created_at": rec.created_at,
    }


class AttachPayload(BaseModel):
    song_id: str | None = None


@router.get("")
def list_recordings(song_id: str | None = None, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return [_out(r) for r in recordings_service.list_for_character(db, character, song_id)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_recording(
    file: UploadFile = File(...),
    title: str = Form(""),
    duration_sec: float = Form(0),
    song_id: str | None = Form(None),
    db: Session = Depends(get_db),
    character: Character = Depends(get_current_character),
):
    data = await file.read()
    rec = recordings_service.create_recording(
        db, character, data, file.content_type or "", title, duration_sec, song_id or None
    )
    return _out(rec)


@router.get("/{recording_id}/audio")
def get_audio(recording_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    rec = recordings_service.get_owned(db, recording_id, character)
    return FileResponse(recordings_service.file_path(rec), media_type=rec.mime_type)


@router.patch("/{recording_id}")
def attach(recording_id: str, payload: AttachPayload, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    rec = recordings_service.get_owned(db, recording_id, character)
    return _out(recordings_service.attach_to_song(db, rec, character, payload.song_id))


@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(recording_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    rec = recordings_service.get_owned(db, recording_id, character)
    recordings_service.delete_recording(db, rec)
