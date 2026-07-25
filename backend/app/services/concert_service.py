"""Solo live performances — the player books a venue and performs; the game
simulates turnout from their fame/fans and the ticket price, paying out revenue
plus fame/fans (or a hit to both for a flop). Distinct from online_service's
multiplayer ticketed concerts. Addresses the "concerts feel flimsy" feedback by
making a show a real, risk/reward activity a solo player can actually hold.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.news import NewsItem
from app.services import time_service

# Small → huge, each gated by fame/fans so an unknown can only busk while stadiums
# are an end-game milestone. rental is paid up front; base_price is a suggested
# ticket price the UI pre-fills.
VENUES = [
    {"id": "busking", "name": "거리 버스킹", "capacity": 50, "rental": 0, "min_fame": 0, "min_fans": 0, "base_price": 5000},
    {"id": "small", "name": "소극장", "capacity": 200, "rental": 500000, "min_fame": 15, "min_fans": 300, "base_price": 15000},
    {"id": "club", "name": "라이브 클럽", "capacity": 500, "rental": 1500000, "min_fame": 30, "min_fans": 1000, "base_price": 25000},
    {"id": "hall", "name": "대형 홀", "capacity": 2000, "rental": 8000000, "min_fame": 50, "min_fans": 5000, "base_price": 40000},
    {"id": "arena", "name": "아레나", "capacity": 10000, "rental": 40000000, "min_fame": 70, "min_fans": 30000, "base_price": 66000},
    {"id": "stadium", "name": "스타디움", "capacity": 40000, "rental": 150000000, "min_fame": 90, "min_fans": 150000, "base_price": 99000},
]
VENUES_BY_ID = {v["id"]: v for v in VENUES}
CONCERT_DAYS = 2  # a show (prep + performance) eats a couple of days


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def list_venues(db: Session, character: Character) -> list[dict]:
    fame = float(character.fame)
    fans = int(character.fans_count)
    money = float(character.money)
    out = []
    for v in VENUES:
        gated = fame >= v["min_fame"] and fans >= v["min_fans"]
        out.append({
            **v,
            "unlocked": gated,
            "affordable": money >= v["rental"],
            "bookable": gated and money >= v["rental"],
        })
    return out


def hold_concert(db: Session, character: Character, venue_id: str, ticket_price: float) -> dict:
    venue = VENUES_BY_ID.get(venue_id)
    if venue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공연장을 찾을 수 없습니다")
    ticket_price = max(0.0, float(ticket_price))

    fame = float(character.fame)
    fans = int(character.fans_count)
    if fame < venue["min_fame"] or fans < venue["min_fans"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{venue['name']} 대관 조건 미달 — 명성 {venue['min_fame']}+ (현재 {round(fame)}), 팬 {venue['min_fans']:,}+ (현재 {fans:,})",
        )
    rental = float(venue["rental"])
    if float(character.money) < rental:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"대관료 {int(rental):,}원이 부족합니다")

    # Turnout: your reachable audience, dampened by a too-high ticket price
    # (bigger stars can charge more), with a little live-event variance.
    interested = fans * 0.5 + fame * 40
    denom = 30000 + fame * 1500
    price_factor = _clamp(1.2 - ticket_price / denom, 0.15, 1.2)
    raw = interested * price_factor * random.uniform(0.9, 1.1)
    attendance = int(max(0, min(venue["capacity"], round(raw))))
    fill = attendance / venue["capacity"] if venue["capacity"] else 0

    revenue = int(round(attendance * ticket_price))
    net = int(round(revenue - rental))
    fame_delta = int(round((fill - 0.5) * 8))          # sold out +4, empty -4
    fans_delta = int(round(attendance * (0.06 if fill >= 0.8 else 0.03)))

    character.money = max(0.0, float(character.money) - rental + revenue)
    character.fame = _clamp(float(character.fame) + fame_delta, 0.0, 100.0)
    character.fans_count = max(0, character.fans_count + fans_delta)

    verdict = "대성공" if fill >= 0.9 else "성공적" if fill >= 0.6 else "아쉬운" if fill >= 0.3 else "썰렁한"
    db.add(NewsItem(
        character_id=character.id, game_date=character.game_date, kind="personal", icon="🎫",
        title="공연 결과",
        body=f"{venue['name']}에서 {verdict} 공연 — 관객 {attendance:,}명 (매진율 {round(fill * 100)}%), "
             f"순수익 {net:,}원, 명성 {fame_delta:+d}, 팬 {fans_delta:+,}.",
    ))

    summary = time_service.advance_days(db, character, CONCERT_DAYS, reason="concert")

    return {
        "venue": venue["name"], "capacity": venue["capacity"], "attendance": attendance,
        "fill_pct": round(fill * 100), "ticket_price": int(ticket_price),
        "revenue": revenue, "rental": int(rental), "net": net,
        "fame_delta": fame_delta, "fans_delta": fans_delta, "verdict": verdict,
        "time": summary,
    }
