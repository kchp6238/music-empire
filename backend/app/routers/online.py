from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import online_service

router = APIRouter(tags=["online"])


# ---- Concerts ----

class ConcertCreate(BaseModel):
    title: str = ""
    venue_capacity: int = 100
    ticket_price: float = 50
    scheduled_at: datetime


@router.get("/concerts")
def concerts(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return online_service.list_upcoming(db, character)


@router.post("/concerts")
def create_concert(payload: ConcertCreate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    c = online_service.create_concert(db, character, payload.title, payload.venue_capacity, payload.ticket_price, payload.scheduled_at)
    return {"id": c.id}


@router.post("/concerts/{concert_id}/ticket")
def buy_ticket(concert_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return online_service.buy_ticket(db, character, concert_id)


# ---- Marketplace ----

class ListingCreate(BaseModel):
    song_id: str
    price: float


@router.get("/marketplace")
def marketplace(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return online_service.list_open(db, character)


@router.post("/marketplace")
def create_listing(payload: ListingCreate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    lst = online_service.create_listing(db, character, payload.song_id, payload.price)
    return {"id": lst.id}


@router.post("/marketplace/{listing_id}/buy")
def buy_listing(listing_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return online_service.buy_listing(db, character, listing_id)
