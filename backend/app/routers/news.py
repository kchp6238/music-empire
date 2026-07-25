from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import news_service

router = APIRouter(prefix="/news", tags=["news"])


class ChoosePayload(BaseModel):
    choice_id: str


@router.get("")
def list_news(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return news_service.list_news(db, character)


@router.post("/advance-day")
def advance_day(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return news_service.advance_one_day(db, character)


@router.post("/{news_id}/choose")
def choose(news_id: str, payload: ChoosePayload, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return news_service.resolve_choice(db, character, news_id, payload.choice_id)
