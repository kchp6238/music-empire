from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.schemas.music import FandomNameUpdate, FandomStatus, MusicStatus, PromoteRequest, PromoteResult
from app.services import music_service

router = APIRouter(prefix="/music", tags=["music"])


@router.get("", response_model=MusicStatus)
def get_status(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return music_service.get_status(db, character)


@router.post("/fandom-name", response_model=FandomStatus)
def set_fandom_name(payload: FandomNameUpdate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return music_service.set_fandom_name(db, character, payload.name)


@router.post("/promote", response_model=PromoteResult, status_code=status.HTTP_201_CREATED)
def promote(payload: PromoteRequest, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return music_service.promote(db, character, payload.song_id)
