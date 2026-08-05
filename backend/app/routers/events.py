from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import events_service

router = APIRouter(prefix="/events", tags=["events"])


class ResolveEvent(BaseModel):
    event_id: str
    choice_index: int


@router.post("/roll")
def roll(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return events_service.roll(character)


@router.post("/resolve", status_code=status.HTTP_201_CREATED)
def resolve(payload: ResolveEvent, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return events_service.resolve(db, character, payload.event_id, payload.choice_index)
