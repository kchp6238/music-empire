from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.community import FeedSongItem, ChartEntry, FollowCreate
from app.routers.songs import get_current_character
from app.services import community_service

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/feed", response_model=list[FeedSongItem])
def feed(db: Session = Depends(get_db)):
    return community_service.get_feed(db)


@router.get("/chart", response_model=list[ChartEntry])
def chart(db: Session = Depends(get_db)):
    return community_service.get_chart(db)


@router.post("/follow", status_code=204)
def follow(payload: FollowCreate, db: Session = Depends(get_db), character=Depends(get_current_character)):
    community_service.follow(db, character.id, payload.followed_type, payload.followed_id)


@router.post("/unfollow", status_code=204)
def unfollow(payload: FollowCreate, db: Session = Depends(get_db), character=Depends(get_current_character)):
    community_service.unfollow(db, character.id, payload.followed_type, payload.followed_id)
