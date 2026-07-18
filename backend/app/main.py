from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, characters, songs, community, fans, progress, collab, company, online

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
app.include_router(progress.router)
app.include_router(collab.router)
app.include_router(company.router)
app.include_router(online.router)


@app.get("/health")
def health():
    return {"status": "ok"}
