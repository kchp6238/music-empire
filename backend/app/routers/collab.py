from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import collab_service

router = APIRouter(prefix="/collab", tags=["collab"])


class InviteCreate(BaseModel):
    song_id: str
    invitee_character_id: str
    role: str
    contribution_pct: float


class InviteRespond(BaseModel):
    accept: bool


@router.post("/invite")
def create_invite(payload: InviteCreate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    inv = collab_service.invite(db, character, payload.song_id, payload.invitee_character_id, payload.role, payload.contribution_pct)
    return {"id": inv.id, "status": inv.status}


@router.get("/invites")
def incoming(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return collab_service.list_incoming(db, character)


@router.post("/invites/{invite_id}/respond")
def respond(invite_id: str, payload: InviteRespond, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return collab_service.respond(db, character, invite_id, payload.accept)


@router.get("/songs/{song_id}/collaborators")
def collaborators(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return collab_service.list_for_song(db, song_id)
