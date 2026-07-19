from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.models.season import SeasonRecord
from app.routers.songs import get_current_character
from app.schemas.character import TrainRequest, TimedActionResult, SeasonRecordOut
from app.services import training_service, time_service
from app.services.trends import trend_for_date

router = APIRouter(tags=["time"])


@router.get("/time")
def current_time(character: Character = Depends(get_current_character)):
    """Where the career currently sits on the in-game calendar."""
    return {
        "game_date": character.game_date,
        "age": character.age,
        "week": time_service.week_index(character),
        "season": time_service.season_label(character),
        "season_index": time_service.season_index(character),
        "trend": trend_for_date(character.game_date),
        "action_days": time_service.ACTION_DAYS,
    }


@router.post("/train", response_model=TimedActionResult)
def train(payload: TrainRequest, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    result = training_service.train(db, character, payload.stat)
    return {"character": character, "time": result["time"], "message": result["message"]}


@router.post("/rest", response_model=TimedActionResult)
def rest(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    result = training_service.rest(db, character)
    return {"character": character, "time": result["time"], "message": result["message"]}


@router.get("/seasons", response_model=list[SeasonRecordOut])
def seasons(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return (
        db.query(SeasonRecord)
        .filter(SeasonRecord.character_id == character.id)
        .order_by(SeasonRecord.season_index.desc())
        .all()
    )
