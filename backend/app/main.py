from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, characters, songs, community, fans

app = FastAPI(title="Music Empire API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(characters.router)
app.include_router(songs.router)
app.include_router(community.router)
app.include_router(fans.router)


@app.get("/health")
def health():
    return {"status": "ok"}
