from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.character import Character
from app.schemas.song import SongDraftCreate, SongDraftUpdate, SongOut, ReleaseResult
from app.services import characters_service, songs_service

router = APIRouter(prefix="/songs", tags=["songs"])


def get_current_character(
    x_character_id: str | None = Header(default=None, alias="X-Character-Id"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Character:
    """Which save the request is acting in.

    Every authenticated router depends on this, so it's also where world
    scoping starts: the returned character carries the world_id that the
    feed, chart, concerts and marketplace filter by.

    The header names the save. It's omitted only by clients that predate save
    selection, which by definition have exactly one character — with more than
    one there is no sensible default and guessing would act on the wrong save.
    """
    if x_character_id:
        character = characters_service.get_owned(db, x_character_id, user.id)
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세이브를 찾을 수 없습니다")
        return character

    character = characters_service.get_by_user(db, user.id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No character for this user")
    return character


@router.post("", response_model=SongOut, status_code=status.HTTP_201_CREATED)
def create_draft(payload: SongDraftCreate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return songs_service.create_draft(db, character, payload.model_dump())


@router.get("", response_model=list[SongOut])
def list_my_songs(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return songs_service.list_released(db, character)


# NOTE: must stay above the /{song_id} routes — otherwise FastAPI matches
# "drafts" as a song_id and this endpoint becomes unreachable.
@router.get("/drafts", response_model=list[SongOut])
def list_my_drafts(db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return songs_service.list_drafts(db, character)


@router.get("/{song_id}", response_model=SongOut)
def get_draft(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    return songs_service.get_owned_draft(db, song_id, character)


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    song = songs_service.get_owned_draft(db, song_id, character)
    songs_service.delete_draft(db, song)


@router.patch("/{song_id}", response_model=SongOut)
def update_draft(song_id: str, payload: SongDraftUpdate, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    song = songs_service.get_owned_draft(db, song_id, character)
    return songs_service.update_draft(db, song, payload.model_dump(exclude_unset=True))


@router.post("/{song_id}/release", response_model=ReleaseResult)
def release_song(song_id: str, db: Session = Depends(get_db), character: Character = Depends(get_current_character)):
    song = songs_service.get_owned_draft(db, song_id, character)
    return songs_service.release_song(db, song, character)
