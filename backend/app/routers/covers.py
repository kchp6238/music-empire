from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import covers_service

router = APIRouter(prefix="/covers", tags=["covers"])


@router.get("/mine")
def list_mine(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    """Which of my songs have art. Lets the studio/results screens show
    thumbnails without probing each song with a 404."""
    return {"song_ids": sorted(covers_service.song_ids_for_character(db, character))}


@router.put("/{song_id}", status_code=status.HTTP_200_OK)
async def upsert(
    song_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    character: Character = Depends(get_current_character),
):
    data = await file.read()
    cover = covers_service.upsert_cover(db, character, song_id, data, file.content_type or "")
    return {"song_id": cover.song_id, "size_bytes": cover.size_bytes, "updated_at": cover.updated_at}


@router.get("/{song_id}/image")
def get_image(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    # Any signed-in player can read: covers are shown on other artists' songs
    # in the feed and chart, not just your own.
    cover = covers_service.get_cover(db, song_id)
    return Response(
        content=cover.image_data,
        media_type=cover.mime_type,
        # Covers change only when the artist redraws them, and the client
        # revalidates on the song's updated_at anyway.
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    covers_service.delete_cover(db, character, song_id)
