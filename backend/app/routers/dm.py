from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import dm_service

router = APIRouter(prefix="/dm", tags=["dm"])


class SendPayload(BaseModel):
    thread_key: str
    body: str


@router.get("/threads")
def threads(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return dm_service.list_threads(db, character)


@router.get("/threads/{thread_key}")
def thread(thread_key: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return dm_service.get_thread(db, character, thread_key)


@router.post("/send")
def send(payload: SendPayload, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return dm_service.send_message(db, character, payload.thread_key, payload.body)


@router.get("/unread")
def unread(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return {"unread": dm_service.unread_count(db, character)}
