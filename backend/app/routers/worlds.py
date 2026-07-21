from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import worlds_service

router = APIRouter(prefix="/worlds", tags=["worlds"])


class WorldCreate(BaseModel):
    name: str = ""
    kind: str = "solo"  # solo | multi


class WorldJoin(BaseModel):
    code: str


def _out(world) -> dict:
    return {
        "id": world.id, "name": world.name, "kind": world.kind,
        "join_code": world.join_code, "created_at": world.created_at,
    }


@router.get("")
def list_saves(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Everything on the save-select screen."""
    return worlds_service.list_saves(db, user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create(payload: WorldCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(worlds_service.create_world(db, user.id, payload.name, payload.kind))


@router.post("/join")
def join(payload: WorldJoin, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Resolve a code to a world. The character in it is made separately, so
    joining and then abandoning character creation leaves nothing behind."""
    return _out(worlds_service.join_by_code(db, payload.code))


@router.delete("/{world_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(world_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    worlds_service.delete_world(db, world_id, user.id)
