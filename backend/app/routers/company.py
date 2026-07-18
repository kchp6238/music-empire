from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.routers.songs import get_current_character
from app.services import company_service

router = APIRouter(prefix="/company", tags=["company"])


class FoundCompany(BaseModel):
    name: str = ""


class RecruitTrainee(BaseModel):
    name: str | None = None


class DebutGroup(BaseModel):
    name: str = ""
    trainee_ids: list[str]


@router.get("/me")
def my_company(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    company = company_service.get_for_owner(db, character)
    if company is None:
        return None
    return company_service.serialize(db, company)


@router.post("", status_code=status.HTTP_201_CREATED)
def found(payload: FoundCompany, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    company = company_service.found(db, character, payload.name)
    return company_service.serialize(db, company)


@router.post("/trainees")
def recruit(payload: RecruitTrainee, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    company_service.recruit_trainee(db, character, payload.name)
    return company_service.serialize(db, company_service.get_for_owner(db, character))


@router.post("/trainees/{trainee_id}/train")
def train(trainee_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    company_service.train_trainee(db, character, trainee_id)
    return company_service.serialize(db, company_service.get_for_owner(db, character))


@router.post("/groups")
def debut(payload: DebutGroup, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    company_service.debut_group(db, character, payload.name, payload.trainee_ids)
    return company_service.serialize(db, company_service.get_for_owner(db, character))
