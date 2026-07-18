from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.character import Character
from app.models.fan import CharacterFanLoyalty, FanPersona
from app.routers.songs import get_current_character

router = APIRouter(prefix="/fans", tags=["fans"])


@router.get("/loyalty")
def my_loyalty(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    rows = (
        db.query(CharacterFanLoyalty, FanPersona)
        .join(FanPersona, CharacterFanLoyalty.persona_id == FanPersona.id)
        .filter(CharacterFanLoyalty.character_id == character.id)
        .all()
    )
    return [{"persona_id": persona.id, "persona_name": persona.name, "loyalty_score": float(loyalty.loyalty_score)} for loyalty, persona in rows]
