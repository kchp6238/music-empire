"""Online connection features (GDD §11): scheduled concerts (ticketed events)
and a song marketplace (licensing/sale between characters).
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.online import Concert, ConcertTicket, MarketplaceListing


def _require_same_world(db: Session, actor: Character, other_character_id: str) -> Character:
    """Both sides of a trade must be in the same save.

    Concert tickets and marketplace sales are the only paths that move money
    between characters, so this is where a solo save's economy would otherwise
    leak into a shared one.
    """
    other = db.get(Character, other_character_id)
    if other is None or other.world_id != actor.world_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="다른 세이브의 항목입니다")
    return other


# ---- Concerts ----

def create_concert(db: Session, host: Character, title: str, venue_capacity: int, ticket_price: float, scheduled_at: datetime) -> Concert:
    if venue_capacity <= 0 or ticket_price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="정원/티켓 가격이 올바르지 않습니다")
    concert = Concert(
        host_character_id=host.id, title=title.strip() or f"{host.artist_name} 콘서트",
        venue_capacity=venue_capacity, ticket_price=ticket_price, scheduled_at=scheduled_at,
    )
    db.add(concert)
    db.commit()
    db.refresh(concert)
    return concert


def _concert_dict(db: Session, concert: Concert, viewer_id: str) -> dict:
    host = db.get(Character, concert.host_character_id)
    sold = db.query(ConcertTicket).filter(ConcertTicket.concert_id == concert.id).count()
    has_ticket = db.get(ConcertTicket, (concert.id, viewer_id)) is not None
    return {
        "id": concert.id, "title": concert.title, "host_name": host.artist_name if host else "?",
        "host_character_id": concert.host_character_id, "venue_capacity": concert.venue_capacity,
        "ticket_price": float(concert.ticket_price), "scheduled_at": concert.scheduled_at,
        "tickets_sold": sold, "has_ticket": has_ticket, "is_host": concert.host_character_id == viewer_id,
    }


def list_upcoming(db: Session, viewer: Character) -> list[dict]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    concerts = (
        db.query(Concert)
        .join(Character, Concert.host_character_id == Character.id)
        .filter(Concert.scheduled_at >= now, Character.world_id == viewer.world_id)
        .order_by(Concert.scheduled_at)
        .all()
    )
    return [_concert_dict(db, c, viewer.id) for c in concerts]


def buy_ticket(db: Session, buyer: Character, concert_id: str) -> dict:
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="콘서트를 찾을 수 없습니다")
    if concert.host_character_id == buyer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자신의 콘서트는 예매할 수 없습니다")
    _require_same_world(db, buyer, concert.host_character_id)
    if db.get(ConcertTicket, (concert_id, buyer.id)) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 예매했습니다")
    sold = db.query(ConcertTicket).filter(ConcertTicket.concert_id == concert_id).count()
    if sold >= concert.venue_capacity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="매진되었습니다")
    price = float(concert.ticket_price)
    if float(buyer.money) < price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자금이 부족합니다")

    buyer.money = float(buyer.money) - price
    host = db.get(Character, concert.host_character_id)
    if host:
        host.money = float(host.money) + price
        host.fame = min(100, float(host.fame) + 0.5)  # small fame bump per attendee
    db.add(ConcertTicket(concert_id=concert_id, character_id=buyer.id))
    db.commit()
    return {"status": "ok", "buyer_money": float(buyer.money)}


# ---- Marketplace ----

def create_listing(db: Session, seller: Character, song_id: str, price: float) -> MarketplaceListing:
    song = db.get(Song, song_id)
    if song is None or song.character_id != seller.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="곡을 찾을 수 없습니다")
    if song.released_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="발매한 곡만 등록할 수 있습니다")
    if price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="가격이 올바르지 않습니다")
    existing = db.query(MarketplaceListing).filter(
        MarketplaceListing.song_id == song_id, MarketplaceListing.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 판매 중인 곡입니다")
    listing = MarketplaceListing(song_id=song_id, seller_character_id=seller.id, price=price, status="open")
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def list_open(db: Session, viewer: Character) -> list[dict]:
    rows = (
        db.query(MarketplaceListing, Song, Character)
        .join(Song, MarketplaceListing.song_id == Song.id)
        .join(Character, MarketplaceListing.seller_character_id == Character.id)
        .filter(MarketplaceListing.status == "open", Character.world_id == viewer.world_id)
        .order_by(MarketplaceListing.created_at.desc())
        .all()
    )
    return [
        {"id": lst.id, "song_id": lst.song_id, "song_title": song.title, "seller_name": seller.artist_name,
         "seller_character_id": seller.id, "price": float(lst.price), "tier": song.tier,
         "overall_score": float(song.overall_score or 0), "is_mine": seller.id == viewer.id}
        for lst, song, seller in rows
    ]


def buy_listing(db: Session, buyer: Character, listing_id: str) -> dict:
    listing = db.get(MarketplaceListing, listing_id)
    if listing is None or listing.status != "open":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="판매 목록을 찾을 수 없습니다")
    if listing.seller_character_id == buyer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자신의 곡은 구매할 수 없습니다")
    _require_same_world(db, buyer, listing.seller_character_id)
    price = float(listing.price)
    if float(buyer.money) < price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자금이 부족합니다")

    buyer.money = float(buyer.money) - price
    seller = db.get(Character, listing.seller_character_id)
    if seller:
        seller.money = float(seller.money) + price
    listing.status = "sold"
    listing.buyer_character_id = buyer.id
    listing.sold_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "sold", "buyer_money": float(buyer.money)}
