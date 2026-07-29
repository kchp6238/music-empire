from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.schemas.sns import CreatePost, CreateComment
from app.services import sns_service

router = APIRouter(prefix="/sns", tags=["sns"])


@router.get("/feed")
def feed(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return sns_service.get_feed(db, character)


@router.get("/profile")
def profile(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return sns_service.profile(db, character)


@router.post("/posts")
def create_post(payload: CreatePost, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return sns_service.create_post(db, character, payload.caption, payload.song_id)


@router.post("/posts/{post_id}/like")
def like(post_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return sns_service.toggle_like(db, character, post_id)


@router.post("/posts/{post_id}/comment")
def comment(post_id: str, payload: CreateComment, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return sns_service.add_comment(db, character, post_id, payload.body)
