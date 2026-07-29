"""In-game phone messages (메시지). Threads are the agency manager ('label')
and rival NPCs ('npc:<id>'). Incoming messages are generated deterministically
and caught up to today (idempotent via dedupe_key); the player can reply and
gets a canned deterministic answer. Everything persists per save."""
import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.character import Character, GAME_EPOCH
from app.models.npc import NpcArtist
from app.models.dm import DmMessage

LABEL_NAME = "소속사 매니저"
LABEL_COLOR = "#E8A33D"

LABEL_WEEKLY = [
    "이번 주도 고생 많았어요. 컨디션 관리 잊지 마세요!",
    "요즘 반응 좋아요. 이 흐름 이어가봅시다 💪",
    "신곡 준비는 잘 되가나요? 필요한 거 있으면 말해줘요.",
    "미팅 잡히면 다시 연락드릴게요. 좋은 하루!",
    "스케줄 정리해뒀어요. 무리하지 말고 가요.",
]
NPC_OUTREACH = [
    "안녕하세요! 곡 잘 듣고 있어요. 언젠가 같이 작업해요 🙌",
    "팬이에요! 다음 곡도 기대할게요 🎧",
    "피처링 생각 있으면 편하게 연락줘요~",
    "무대에서 뵀으면 좋겠네요. 화이팅!",
]
LABEL_REPLIES = [
    "네, 확인했어요! 바로 챙겨둘게요.",
    "좋아요. 그렇게 진행하죠 👍",
    "알겠습니다. 또 필요한 거 있으면 말해줘요.",
    "언제나 응원해요. 파이팅!",
]
NPC_REPLIES = [
    "오 좋아요! 조만간 봐요 😄",
    "ㅎㅎ 연락 고마워요!",
    "기대할게요 🔥",
    "좋은 아이디어네요, 생각해볼게요!",
]


def _week_index(d: date) -> int:
    return max(0, (d - GAME_EPOCH).days // 7)


def _week_date(w: int) -> date:
    return GAME_EPOCH + timedelta(days=w * 7 + 2)


def ensure_messages(db: Session, character: Character) -> None:
    today = character.game_date
    existing = {k for (k,) in db.query(DmMessage.dedupe_key).filter(DmMessage.character_id == character.id).all() if k}
    new: list[DmMessage] = []

    def add(dedupe, thread_key, name, color, body, d):
        if dedupe in existing or d > today:
            return
        new.append(DmMessage(
            world_id=character.world_id, character_id=character.id, thread_key=thread_key,
            thread_name=name, thread_color=color, from_me=False, body=body, game_date=d, dedupe_key=dedupe,
        ))

    # label welcome + recent weekly notes
    add("label:welcome", "label", LABEL_NAME, LABEL_COLOR,
        f"{character.artist_name} 님, 데뷔 축하해요! 저는 담당 매니저예요. 궁금한 건 언제든 메시지 주세요 😊",
        GAME_EPOCH)
    cur = _week_index(today)
    for w in range(max(0, cur - 1), cur + 1):
        rng = random.Random(f"dmlabel:{character.id}:{w}")
        add(f"label:week:{w}", "label", LABEL_NAME, LABEL_COLOR, rng.choice(LABEL_WEEKLY), _week_date(w))

    # a rival or two reach out
    npcs = db.query(NpcArtist).all()
    if npcs:
        for w in range(max(0, cur - 1), cur + 1):
            rng = random.Random(f"dmnpc:{character.id}:{w}")
            artist = rng.choice(npcs)
            add(f"npc:{artist.id}:{w}", f"npc:{artist.id}", artist.name, artist.color, rng.choice(NPC_OUTREACH), _week_date(w))

    if new:
        db.add_all(new)
        db.commit()


def list_threads(db: Session, character: Character) -> list[dict]:
    ensure_messages(db, character)
    rows = (
        db.query(DmMessage)
        .filter(DmMessage.character_id == character.id)
        .order_by(DmMessage.game_date.asc(), DmMessage.created_at.asc())
        .all()
    )
    threads: dict[str, dict] = {}
    for m in rows:
        t = threads.setdefault(m.thread_key, {
            "thread_key": m.thread_key, "name": m.thread_name, "color": m.thread_color,
            "last_body": "", "last_date": None, "unread": 0,
        })
        t["name"] = m.thread_name
        t["color"] = m.thread_color
        t["last_body"] = m.body
        t["last_date"] = m.game_date.isoformat() if m.game_date else None
        if not m.from_me and not m.read_flag:
            t["unread"] += 1
    # newest-active thread first
    return sorted(threads.values(), key=lambda t: t["last_date"] or "", reverse=True)


def get_thread(db: Session, character: Character, thread_key: str) -> dict:
    ensure_messages(db, character)
    rows = (
        db.query(DmMessage)
        .filter(DmMessage.character_id == character.id, DmMessage.thread_key == thread_key)
        .order_by(DmMessage.game_date.asc(), DmMessage.created_at.asc())
        .all()
    )
    # mark incoming as read
    changed = False
    for m in rows:
        if not m.from_me and not m.read_flag:
            m.read_flag = True
            changed = True
    if changed:
        db.commit()
    name = rows[-1].thread_name if rows else thread_key
    color = rows[-1].thread_color if rows else None
    return {
        "thread_key": thread_key, "name": name, "color": color,
        "messages": [
            {"id": m.id, "from_me": m.from_me, "body": m.body,
             "game_date": m.game_date.isoformat() if m.game_date else None}
            for m in rows
        ],
    }


def send_message(db: Session, character: Character, thread_key: str, body: str) -> dict:
    body = (body or "").strip()[:300]
    if not body:
        return {"messages": []}
    # name/color come from the thread's existing messages
    last = (
        db.query(DmMessage)
        .filter(DmMessage.character_id == character.id, DmMessage.thread_key == thread_key)
        .order_by(DmMessage.created_at.desc())
        .first()
    )
    name = last.thread_name if last else (LABEL_NAME if thread_key == "label" else thread_key)
    color = last.thread_color if last else LABEL_COLOR
    today = character.game_date

    mine = DmMessage(world_id=character.world_id, character_id=character.id, thread_key=thread_key,
                     thread_name=name, thread_color=color, from_me=True, body=body, game_date=today, read_flag=True)
    db.add(mine)
    db.flush()

    # canned auto-reply, seeded so a given reply thread is stable
    count = db.query(DmMessage).filter(DmMessage.character_id == character.id, DmMessage.thread_key == thread_key).count()
    rng = random.Random(f"dmreply:{character.id}:{thread_key}:{count}")
    pool = LABEL_REPLIES if thread_key == "label" else NPC_REPLIES
    reply = DmMessage(world_id=character.world_id, character_id=character.id, thread_key=thread_key,
                      thread_name=name, thread_color=color, from_me=False, body=rng.choice(pool),
                      game_date=today, read_flag=True)
    db.add(reply)
    db.commit()
    return get_thread(db, character, thread_key)


def unread_count(db: Session, character: Character) -> int:
    ensure_messages(db, character)
    return (
        db.query(DmMessage)
        .filter(DmMessage.character_id == character.id, DmMessage.from_me == False, DmMessage.read_flag == False)  # noqa: E712
        .count()
    )
