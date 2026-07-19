from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import achievements
from app.services.trends import trend_for_date

router = APIRouter(tags=["progress"])


@router.get("/achievements")
def my_achievements(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return achievements.list_for_character(db, character)


@router.get("/trends/current")
def trend_now(character: Character = Depends(get_current_character)):
    """The trend at the player's own in-game date.

    Now needs auth: trends rotate on the in-game calendar, and each character
    sits at their own point on it, so there's no single global "this week".
    """
    return trend_for_date(character.game_date)
