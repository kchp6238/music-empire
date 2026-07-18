from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.character import CharacterCreate, CharacterOut, CharacterMeResponse
from app.services import characters_service, fan_simulation, achievements

router = APIRouter(prefix="/characters", tags=["characters"])


@router.post("", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
def create_character(payload: CharacterCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if characters_service.get_by_user(db, user.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Character already exists for this user")
    return characters_service.create_character(db, user.id, payload.artist_name, payload.background_id)


@router.get("/me", response_model=CharacterMeResponse)
def read_my_character(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    character = characters_service.get_by_user(db, user.id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No character for this user")
    # Settle offline fan drift + passive income, then refresh achievements
    # (docs/core-loop.md §3/§5). Both are safe to run on every load.
    offline_summary = fan_simulation.settle(db, character)
    achievements.check_and_unlock(db, character)
    return {"character": character, "offline_summary": offline_summary}
