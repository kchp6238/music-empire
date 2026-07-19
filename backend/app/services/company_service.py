"""Company / label system (GDD §12): found a company, recruit and train
trainees, debut them into groups. A meta-layer over the solo systems.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.company import Company, Trainee, Group
from app.services import time_service

FOUND_COST = 5000000
RECRUIT_COST = 800000
TRAIN_COST = 300000
DEBUT_MIN_STAGE = 3
MAX_CURRICULUM_STAGE = 5

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
    if float(character.money) < FOUND_COST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"설립 자본 {FOUND_COST}원이 부족합니다")
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
             "member_ids": [t.id for t in g.members]}
            for g in company.groups
        ],
    }
