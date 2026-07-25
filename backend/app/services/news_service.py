"""Daily in-world news & choice events (GDD "매일의 소식").

`advance_one_day` moves the calendar a single day (settling fans/income like any
advance) and rolls that day's news. Generation is seeded on (character, date) so
a given day always yields the same items. Flavor news is read-only; `choice`
events carry `choices` the player resolves, applying money/fans/fame effects.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.news import NewsItem
from app.models.npc import NpcSong, NpcArtist
from app.services import time_service

# Read-only flavor news, grouped by tone. One is picked on a "flavor" day.
FLAVOR = {
    "fun": ("🎉", [
        "길거리 버스킹 영상이 우연히 화제가 됐어요. 사람들이 당신을 알아보기 시작했대요.",
        "예전에 올린 데모가 커뮤니티에서 밈으로 돌아다니고 있어요.",
        "한 유튜버가 당신 곡으로 챌린지를 만들었어요. 반응이 좋네요.",
        "고양이 영상에 당신 곡이 BGM으로 깔려 조회수가 폭발 중이에요.",
        "카페에서 당신 노래가 흘러나왔는데, 아직 아무도 못 알아봤어요. 언젠가는요.",
    ]),
    "serious": ("⚠️", [
        "비슷한 멜로디로 표절 시비가 잠깐 붙었지만 근거 없는 걸로 밝혀졌어요.",
        "작업 파일이 날아갈 뻔했어요. 다행히 백업이 있었죠.",
        "악성 댓글이 며칠째 이어지고 있어요. 멘탈 관리가 필요해요.",
        "정산 문제로 골머리를 앓았어요. 소속 없이 활동하는 건 쉽지 않네요.",
    ]),
    "industry": ("📰", [
        "올여름 대형 페스티벌 라인업이 공개됐어요. 언젠가 저 무대에 서고 싶네요.",
        "스트리밍 정산 단가가 소폭 올랐다는 소식이에요.",
        "요즘 차트는 온통 여름 시즌송이네요.",
        "한 대형 기획사가 신인 오디션을 연다고 합니다.",
    ]),
    "rival": ("🎤", [
        "요즘 뜨는 신인이 신곡으로 차트를 휩쓸고 있어요. 자극이 되네요.",
        "라이벌 아티스트가 콘서트를 매진시켰다는 소식이에요.",
        "동료 뮤지션이 대형 기획사와 계약했대요.",
    ]),
    "personal": ("💌", [
        "오랜 팬이 손편지를 보내왔어요. '당신 노래로 힘든 시기를 버텼다'고.",
        "가족이 당신 음악을 응원한다며 연락이 왔어요.",
        "지친 하루였지만, 댓글 하나가 다시 힘을 줬어요.",
    ]),
}

# Choice events — the player picks; the chosen option's effects are applied.
CHOICE_EVENTS = [
    {
        "icon": "📺", "title": "광고 모델 제안",
        "body": "한 브랜드가 광고 모델을 제안했어요. 수익은 좋지만 이미지 관리가 필요해요.",
        "choices": [
            {"id": "accept", "label": "수락한다", "money": 2000000, "fans": -30, "fame": 0,
             "outcome": "광고를 찍었어요. 통장은 두둑해졌지만 일부 팬은 아쉬워했어요."},
            {"id": "decline", "label": "거절한다", "money": 0, "fans": 0, "fame": 3,
             "outcome": "제안을 정중히 거절했어요. 진정성 있다는 반응이 나왔어요."},
        ],
    },
    {
        "icon": "🎚️", "title": "신인 피처링 요청",
        "body": "한 신인이 피처링을 부탁했어요. 도와주면 이름값이 오르지만 품이 들어요.",
        "choices": [
            {"id": "help", "label": "도와준다", "money": 0, "fans": 40, "fame": 5,
             "outcome": "피처링이 좋은 반응을 얻어 서로 윈윈했어요."},
            {"id": "pass", "label": "사양한다", "money": 0, "fans": 0, "fame": 0,
             "outcome": "이번엔 사양했어요. 신인은 아쉬워했지만 이해했어요."},
        ],
    },
    {
        "icon": "💢", "title": "도를 넘은 악플",
        "body": "악성 댓글이 도를 넘었어요. 어떻게 대응할까요?",
        "choices": [
            {"id": "ignore", "label": "묵묵히 음악으로", "money": 0, "fans": 0, "fame": 2,
             "outcome": "묵묵히 음악으로 답했어요. 시간이 지나자 사그라들었어요."},
            {"id": "confront", "label": "정면 대응한다", "money": 0, "fans": 60, "fame": -1,
             "outcome": "당당한 대응에 팬들이 결집했어요. 일부는 과했다고도 하네요."},
        ],
    },
    {
        "icon": "🤝", "title": "자선 공연 제안",
        "body": "무료 자선 공연 제안이 왔어요. 참여하면 비용은 들지만 이미지가 올라가요.",
        "choices": [
            {"id": "join", "label": "참여한다", "money": -500000, "fans": 20, "fame": 6,
             "outcome": "좋은 일에 함께했어요. 진심이 전해졌는지 이미지가 올라갔어요."},
            {"id": "skip", "label": "다음 기회에", "money": 0, "fans": 0, "fame": 0,
             "outcome": "이번엔 일정상 함께하지 못했어요."},
        ],
    },
    {
        "icon": "💰", "title": "투자 제안",
        "body": "누군가 당신의 다음 앨범에 투자하겠다고 해요. 대신 약간의 자율성을 요구하네요.",
        "choices": [
            {"id": "take", "label": "투자 받는다", "money": 5000000, "fans": 0, "fame": -2,
             "outcome": "제작비를 확보했지만 약간의 자율성을 내줬어요."},
            {"id": "refuse", "label": "혼자 간다", "money": 0, "fans": 0, "fame": 2,
             "outcome": "스스로 해내기로 했어요. 뚝심 있다는 평가를 받았어요."},
        ],
    },
]


def _rival_news_for_day(db: Session, character: Character, day, rng) -> list[NewsItem]:
    """News about the OTHER artists in the world — grounds the feed in real
    events (a rival's new single, a chart mover) so it isn't all about you and
    features a variety of artists and genres. Each carries the artist as its
    `subject` so the card can show an avatar and link to their profile."""
    items: list[NewsItem] = []

    # NPC releases that landed on this exact day → "X, 신곡 'Y' 발매".
    releases = (
        db.query(NpcSong, NpcArtist)
        .join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id)
        .filter(NpcSong.world_id == character.world_id, NpcSong.released_on == day)
        .all()
    )
    for ns, artist in releases[:2]:
        genre = f"{artist.genre} " if artist.genre else ""
        hot = "화제를 모으고 있어요" if float(ns.score) >= 80 else "공개됐어요"
        items.append(NewsItem(
            character_id=character.id, game_date=day, kind="rival", icon="🎵",
            title="라이벌 신곡", body=f"{artist.name}, {genre}신곡 '{ns.title}'을(를) 발매했어요. {hot}.",
            subject_type="npc", subject_id=artist.id, subject_name=artist.name, subject_color=artist.color,
        ))

    # Occasional "chart mover" flavor about a random rival (genre-diverse).
    if not items and rng.random() < 0.30:
        artist = (
            db.query(NpcArtist)
            .join(NpcSong, NpcSong.npc_artist_id == NpcArtist.id)
            .filter(NpcSong.world_id == character.world_id, NpcSong.released_on <= day)
            .order_by(func_random()).first()
        )
        if artist:
            genre = f"{artist.genre} " if artist.genre else ""
            line = rng.choice([
                f"{genre}아티스트 {artist.name}이(가) 차트 상위권을 지키고 있어요.",
                f"{artist.name}의 {genre}무대가 음악방송에서 호평받았어요.",
                f"{artist.name}, 팬미팅 매진 소식이에요.",
            ])
            items.append(NewsItem(
                character_id=character.id, game_date=day, kind="rival", icon="🎤",
                title="라이벌 소식", body=line,
                subject_type="npc", subject_id=artist.id, subject_name=artist.name, subject_color=artist.color,
            ))

    return items


def _generate_for_day(db: Session, character: Character, day) -> list[NewsItem]:
    """News for one day, seeded so it's stable. Personal flavor/choice PLUS
    rival/world news so the feed isn't all about the player. Skips days that
    already have news (idempotent if re-advanced onto the same date)."""
    existing = (
        db.query(NewsItem)
        .filter(NewsItem.character_id == character.id, NewsItem.game_date == day)
        .count()
    )
    if existing:
        return []

    # make sure the rivals' catalogue is caught up to this day so their releases
    # can surface as news.
    from app.services import npc_service
    npc_service.ensure_catalogue(db, character.world_id, day)

    rng = random.Random(f"{character.id}:{day.isoformat()}")
    items: list[NewsItem] = []

    # personal thread
    roll = rng.random()
    if roll < 0.20:
        ev = rng.choice(CHOICE_EVENTS)
        items.append(NewsItem(
            character_id=character.id, game_date=day, kind="choice",
            icon=ev["icon"], title=ev["title"], body=ev["body"], choices=ev["choices"],
        ))
    elif roll < 0.70:
        kind = rng.choice(list(FLAVOR.keys()))
        icon, pool = FLAVOR[kind]
        items.append(NewsItem(
            character_id=character.id, game_date=day, kind=kind,
            icon=icon, title=_TITLES.get(kind, "소식"), body=rng.choice(pool),
        ))

    # rival/world thread (independent of the personal one)
    items.extend(_rival_news_for_day(db, character, day, rng))

    for it in items:
        db.add(it)
    return items


def func_random():
    """DB-agnostic random ordering (SQLite `random()` / Postgres `random()`)."""
    from sqlalchemy import func
    return func.random()


_TITLES = {"fun": "이런 일이", "serious": "주의", "industry": "업계 소식", "rival": "라이벌 소식", "personal": "따뜻한 소식"}


def advance_one_day(db: Session, character: Character) -> dict:
    """Spend a single day: settle the calendar and roll the new day's news."""
    summary = time_service.advance_days(db, character, 1, reason="day")
    new_items = _generate_for_day(db, character, character.game_date)
    db.commit()
    return {"time": summary, "news": [serialize(n) for n in new_items]}


def list_news(db: Session, character: Character, limit: int = 60) -> list[dict]:
    rows = (
        db.query(NewsItem)
        .filter(NewsItem.character_id == character.id)
        .order_by(NewsItem.game_date.desc(), NewsItem.created_at.desc())
        .limit(limit)
        .all()
    )
    return [serialize(n) for n in rows]


def resolve_choice(db: Session, character: Character, news_id: str, choice_id: str) -> dict:
    news = db.get(NewsItem, news_id)
    if news is None or news.character_id != character.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="소식을 찾을 수 없습니다")
    if news.kind != "choice" or not news.choices:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="선택할 수 있는 소식이 아닙니다")
    if news.resolved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 결정한 소식입니다")

    choice = next((c for c in news.choices if c["id"] == choice_id), None)
    if choice is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="없는 선택지입니다")

    character.money = max(0.0, float(character.money) + float(choice.get("money", 0)))
    character.fans_count = max(0, character.fans_count + int(choice.get("fans", 0)))
    character.fame = max(0.0, min(100.0, float(character.fame) + float(choice.get("fame", 0))))

    news.resolved = True
    news.chosen_id = choice_id
    news.outcome = choice.get("outcome", "")
    db.commit()
    return {"news": serialize(news), "effect": {"money": choice.get("money", 0), "fans": choice.get("fans", 0), "fame": choice.get("fame", 0)}}


def serialize(n: NewsItem) -> dict:
    return {
        "id": n.id, "game_date": n.game_date.isoformat() if n.game_date else None,
        "kind": n.kind, "icon": n.icon, "title": n.title, "body": n.body,
        "choices": [{"id": c["id"], "label": c["label"]} for c in (n.choices or [])],
        "resolved": n.resolved, "chosen_id": n.chosen_id, "outcome": n.outcome,
        "subject_type": n.subject_type, "subject_id": n.subject_id,
        "subject_name": n.subject_name, "subject_color": n.subject_color,
    }
