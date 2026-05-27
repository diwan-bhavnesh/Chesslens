from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, games, analysis, users, profile

import os
if os.getenv("APP_ENV", "development") == "development":
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chesslens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(games.router, prefix="/games", tags=["games"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])


@app.get("/health")
def health():
    return {"status": "ok"}
