"""Company / label system (GDD §12): found a company, recruit and train
trainees, debut them into groups. A meta-layer over the solo systems.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.company import Company, Trainee, Group
from app.services import time_service

# Founding a label is an end-game milestone, not an early-game purchase: it
# takes real capital AND a track record (an unknown can't run a company).
FOUND_COST = 30000000
FOUND_MIN_FAME = 60
FOUND_MIN_FANS = 3000
FOUND_MIN_HITS = 3        # released songs scoring 65+ (성공/대박)
HIT_SCORE = 65
RECRUIT_COST = 1500000
TRAIN_COST = 500000
DEBUT_MIN_STAGE = 3
MAX_CURRICULUM_STAGE = 5


def found_requirements(db: Session, character: Character) -> dict:
    """The gate for founding a company, plus the player's current standing —
    surfaced so the UI can show progress instead of a bare error."""
    hits = (
        db.query(Song)
        .filter(Song.character_id == character.id, Song.released_at.isnot(None), Song.overall_score >= HIT_SCORE)
        .count()
    )
    return {
        "cost": FOUND_COST,
        "min_fame": FOUND_MIN_FAME, "min_fans": FOUND_MIN_FANS, "min_hits": FOUND_MIN_HITS, "hit_score": HIT_SCORE,
        "fame": round(float(character.fame)), "fans": int(character.fans_count), "hits": hits,
        "money": float(character.money),
        "eligible": (
            float(character.fame) >= FOUND_MIN_FAME and int(character.fans_count) >= FOUND_MIN_FANS
            and hits >= FOUND_MIN_HITS and float(character.money) >= FOUND_COST
        ),
    }

_TRAINEE_NAMES = ["소원", "하늘", "지우", "민재", "서연", "도윤", "예린", "하준", "수아", "은우", "다인", "루아"]


def _trainee_stats():
    return {k: random.randint(15, 40) for k in ["composing", "lyrics", "arrangement", "vocal", "production", "mixing", "business", "marketing"]}


def _trainee_talent():
    return {k: random.randint(30, 60) for k in ["genius", "creativity", "ear", "charisma", "effort", "leadership", "luck"]}


def get_for_owner(db: Session, character: Character) -> Company | None:
    return db.query(Company).filter(Company.owner_character_id == character.id).first()


def found(db: Session, character: Character, name: str) -> Company:
    if get_for_owner(db, character):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 회사를 소유하고 있습니다")
    req = found_requirements(db, character)
    if not (req["fame"] >= FOUND_MIN_FAME and req["fans"] >= FOUND_MIN_FANS and req["hits"] >= FOUND_MIN_HITS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"회사 설립 조건 미달 — 명성 {FOUND_MIN_FAME}+ (현재 {req['fame']}), "
                f"팬 {FOUND_MIN_FANS:,}+ (현재 {req['fans']:,}), "
                f"히트곡({HIT_SCORE}점+) {FOUND_MIN_HITS}곡+ (현재 {req['hits']}곡)"
            ),
        )
    if float(character.money) < FOUND_COST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"설립 자본 {FOUND_COST:,}원이 부족합니다 (현재 {int(character.money):,}원)")
    character.money = float(character.money) - FOUND_COST
    company = Company(owner_character_id=character.id, name=name.strip() or f"{character.artist_name} 엔터", capital=0)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _require_company(db: Session, character: Character) -> Company:
    company = get_for_owner(db, character)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="회사가 없습니다")
    return company


def recruit_trainee(db: Session, character: Character, name: str | None) -> Trainee:
    company = _require_company(db, character)
    if float(character.money) < RECRUIT_COST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"모집 비용 {RECRUIT_COST}원이 부족합니다")
    character.money = float(character.money) - RECRUIT_COST
    trainee = Trainee(
        company_id=company.id, name=(name or random.choice(_TRAINEE_NAMES)).strip() or random.choice(_TRAINEE_NAMES),
        stats=_trainee_stats(), talent=_trainee_talent(), curriculum_stage=0,
    )
    db.add(trainee)
    db.commit()
    time_service.advance_days(db, character, time_service.ACTION_DAYS["recruit"], reason="recruit")
    db.refresh(trainee)
    return trainee


def train_trainee(db: Session, character: Character, trainee_id: str) -> Trainee:
    company = _require_company(db, character)
    trainee = db.get(Trainee, trainee_id)
    if trainee is None or trainee.company_id != company.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="연습생을 찾을 수 없습니다")
    if trainee.curriculum_stage >= MAX_CURRICULUM_STAGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 최종 단계입니다")
    if float(character.money) < TRAIN_COST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"트레이닝 비용 {TRAIN_COST}원이 부족합니다")
    character.money = float(character.money) - TRAIN_COST

    # effort talent scales how fast stats grow per training session
    effort = trainee.talent.get("effort", 50)
    gain_scale = 1 + (effort - 50) / 100
    new_stats = {k: min(95, round(v + random.randint(3, 8) * gain_scale)) for k, v in trainee.stats.items()}
    trainee.stats = new_stats
    trainee.curriculum_stage += 1
    db.commit()
    time_service.advance_days(db, character, time_service.ACTION_DAYS["trainee_train"], reason="trainee_train")
    db.refresh(trainee)
    return trainee


def debut_group(db: Session, character: Character, name: str, trainee_ids: list[str]) -> Group:
    company = _require_company(db, character)
    if not trainee_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="멤버를 최소 1명 선택하세요")
    trainees = [db.get(Trainee, tid) for tid in trainee_ids]
    for t in trainees:
        if t is None or t.company_id != company.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="연습생을 찾을 수 없습니다")
        if t.group_id is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{t.name}은(는) 이미 그룹 소속입니다")
        if t.curriculum_stage < DEBUT_MIN_STAGE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{t.name}은(는) 데뷔 단계({DEBUT_MIN_STAGE})에 못 미칩니다")

    # group fame/fans seeded from average member skill
    avg_skill = sum(sum(t.stats.values()) / len(t.stats) for t in trainees) / len(trainees)
    group = Group(company_id=company.id, name=name.strip() or "신인 그룹", fame=round(avg_skill * 0.4), fans_count=round(avg_skill * 20))
    db.add(group)
    db.flush()
    for t in trainees:
        t.group_id = group.id
    db.commit()
    db.refresh(group)
    return group


def serialize(db: Session, company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "capital": float(company.capital),
        "trainees": [
            {"id": t.id, "name": t.name, "stats": t.stats, "talent": t.talent,
             "curriculum_stage": t.curriculum_stage, "group_id": t.group_id}
            for t in company.trainees
        ],
        "groups": [
            {"id": g.id, "name": g.name, "fame": float(g.fame), "fans_count": g.fans_count,
             "total_earnings": float(g.total_earnings or 0), "activity_log": (g.activity_log or [])[:8],
             "member_ids": [t.id for t in g.members]}
            for g in company.groups
        ],
    }
