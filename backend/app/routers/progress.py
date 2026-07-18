from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import achievements
from app.services.trends import current_trend

router = APIRouter(tags=["progress"])


@router.get("/achievements")
def my_achievements(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return achievements.list_for_character(db, character)


@router.get("/trends/current")
def trend_now():
    """Public — this week's hot genre/mood (deterministic, no auth needed)."""
    return current_trend()
