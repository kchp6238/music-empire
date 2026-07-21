from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.character import Character
from app.routers.songs import get_current_character
from app.schemas.character import CharacterCreate, CharacterOut, CharacterMeResponse
from app.services import characters_service, achievements, worlds_service

router = APIRouter(prefix="/characters", tags=["characters"])


@router.post("", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
def create_character(payload: CharacterCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # One career per save, so the check is per world rather than per account.
    world = worlds_service.get_for_user(db, payload.world_id, user.id)
    if characters_service.get_in_world(db, user.id, world.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이 세이브에는 이미 캐릭터가 있습니다")
    return characters_service.create_character(db, user.id, payload.artist_name, payload.background_id, world.id)


@router.get("/me", response_model=CharacterMeResponse)
def read_my_character(character: Character = Depends(get_current_character), db: Session = Depends(get_db)):
    # Which save this is comes from the X-Character-Id header — see
    # routers/songs.py::get_current_character.
    #
    # No time settles on load any more — the calendar only moves when the
    # player takes an action (services/time_service.py). Achievements are
    # still refreshed here so they reflect any state changed elsewhere.
    achievements.check_and_unlock(db, character)
    return {"character": character}
