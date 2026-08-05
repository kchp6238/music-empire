"""Life / celebrity events (GDD life-sim flavor). The player rolls a random
event and picks how to respond; each choice shifts fame/fans/money with a
trade-off. Events are code-defined (no table); resolving one advances a day so
the roll-reroll loop is naturally paced.

Effect keys per choice: `fame` (absolute), `fans_pct` (fraction of current
fans, +/-), `money` (absolute won).
"""
import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.services import time_service

LIFE_EVENTS = [
    {
        "id": "romance_costar", "emoji": "💘", "title": "열애설 보도",
        "desc": "인기 배우와의 열애설이 대서특필됐어요. 어떻게 대응할까요?",
        "choices": [
            {"label": "공개 인정", "fame": 4, "fans_pct": -0.04, "money": 0, "note": "솔직함에 호감이 생겼지만 일부 팬은 마음을 접었어요."},
            {"label": "단호히 부인", "fame": -1, "fans_pct": 0.01, "money": 0, "note": "논란은 곧 잦아들었어요."},
            {"label": "묵묵부답", "fame": 0, "fans_pct": -0.01, "money": 0, "note": "루머가 한동안 맴돌았어요."},
        ],
    },
    {
        "id": "past_post", "emoji": "⚠️", "title": "과거 게시글 논란",
        "desc": "예전 SNS 글이 재발굴돼 논란이 됐어요.",
        "choices": [
            {"label": "진심 어린 사과", "fame": -2, "fans_pct": 0.02, "money": 0, "note": "성숙한 대처에 팬심이 오히려 단단해졌어요."},
            {"label": "차분히 해명", "fame": 0, "fans_pct": 0.0, "money": 0, "note": "오해가 어느 정도 풀렸어요."},
            {"label": "무대응", "fame": -3, "fans_pct": -0.02, "money": 0, "note": "침묵이 길어지며 여론이 나빠졌어요."},
        ],
    },
    {
        "id": "cf_offer", "emoji": "📸", "title": "광고 모델 제안",
        "desc": "대형 브랜드가 광고 모델을 제안했어요.",
        "choices": [
            {"label": "계약 (이미지 상승)", "fame": 3, "fans_pct": 0.01, "money": 8_000_000, "note": "광고가 대박 나며 인지도가 올랐어요."},
            {"label": "정중히 거절", "fame": 0, "fans_pct": 0.0, "money": 0, "note": "다음 기회를 노리기로 했어요."},
        ],
    },
    {
        "id": "variety_offer", "emoji": "📺", "title": "인기 예능 섭외",
        "desc": "화제의 예능에서 섭외가 왔어요. 부담도 크지만 노출도 커요.",
        "choices": [
            {"label": "출연", "fame": 4, "fans_pct": 0.03, "money": 1_500_000, "note": "예능감이 통해 새 팬이 유입됐어요."},
            {"label": "고사", "fame": -1, "fans_pct": 0.0, "money": 0, "note": "음악에 집중하기로 했어요."},
        ],
    },
    {
        "id": "charity", "emoji": "🕊️", "title": "기부 요청",
        "desc": "한 재단에서 기부와 홍보대사를 부탁했어요.",
        "choices": [
            {"label": "기부 (선한 영향력)", "fame": 3, "fans_pct": 0.02, "money": -3_000_000, "note": "선행이 미담으로 퍼졌어요."},
            {"label": "조용히 사양", "fame": 0, "fans_pct": -0.005, "money": 0, "note": "아쉬움을 남겼어요."},
        ],
    },
    {
        "id": "rival_shade", "emoji": "🔥", "title": "라이벌의 견제",
        "desc": "한 라이벌이 인터뷰에서 당신을 저격하는 뉘앙스를 남겼어요.",
        "choices": [
            {"label": "쿨하게 응수", "fame": 2, "fans_pct": 0.015, "money": 0, "note": "품격 있는 대응에 대중이 반응했어요."},
            {"label": "정면 반박", "fame": 1, "fans_pct": -0.01, "money": 0, "note": "설전이 붙어 시끄러워졌어요."},
            {"label": "무시", "fame": 0, "fans_pct": 0.0, "money": 0, "note": "신경 쓰지 않기로 했어요."},
        ],
    },
    {
        "id": "dance_challenge", "emoji": "💃", "title": "챌린지 열풍",
        "desc": "당신 곡의 챌린지가 SNS에서 유행 조짐을 보여요.",
        "choices": [
            {"label": "직접 챌린지 참여", "fame": 3, "fans_pct": 0.05, "money": 500_000, "note": "밈이 터지며 조회수가 치솟았어요."},
            {"label": "지켜보기", "fame": 1, "fans_pct": 0.01, "money": 0, "note": "은근한 화제성이 이어졌어요."},
        ],
    },
]
EVENTS_BY_ID = {e["id"]: e for e in LIFE_EVENTS}


def _public(ev: dict) -> dict:
    """The player never sees the numbers up front — just the situation and the
    choice labels."""
    return {
        "id": ev["id"], "emoji": ev["emoji"], "title": ev["title"], "desc": ev["desc"],
        "choices": [{"label": c["label"]} for c in ev["choices"]],
    }


def roll(_character: Character) -> dict:
    return _public(random.choice(LIFE_EVENTS))


def resolve(db: Session, character: Character, event_id: str, choice_index: int) -> dict:
    ev = EVENTS_BY_ID.get(event_id)
    if ev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이벤트를 찾을 수 없습니다")
    if not (0 <= choice_index < len(ev["choices"])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="선택지가 올바르지 않습니다")
    c = ev["choices"][choice_index]

    fans = int(character.fans_count)
    fame_delta = float(c.get("fame", 0))
    fans_delta = round(fans * c.get("fans_pct", 0.0))
    money_delta = float(c.get("money", 0))

    character.fame = max(0, min(100, float(character.fame) + fame_delta))
    character.fans_count = max(0, fans + fans_delta)
    character.money = max(0, float(character.money) + money_delta)
    db.commit()
    time_service.advance_days(db, character, 1, reason="life_event")

    return {
        "title": ev["title"], "emoji": ev["emoji"], "choice_label": c["label"], "note": c["note"],
        "fame_delta": fame_delta, "fans_delta": fans_delta, "money_delta": money_delta,
        "character_fame": float(character.fame), "character_fans": int(character.fans_count),
        "character_money": float(character.money),
    }
