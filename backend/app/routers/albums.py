from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.schemas.album import AlbumCreate, AlbumOut
from app.services import albums_service

router = APIRouter(prefix="/albums", tags=["albums"])


@router.get("", response_model=list[AlbumOut])
def list_albums(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return albums_service.list_albums(db, character)


@router.post("", response_model=AlbumOut, status_code=status.HTTP_201_CREATED)
def create_album(payload: AlbumCreate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return albums_service.create_album(db, character, payload.model_dump())
