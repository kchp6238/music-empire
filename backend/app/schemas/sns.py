from pydantic import BaseModel


class CreatePost(BaseModel):
    caption: str = ""
    song_id: str | None = None


class CreateComment(BaseModel):
    body: str
