import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import auth, games, analysis, users, profile

import os
if os.getenv("APP_ENV", "development") == "development":
    Base.metadata.create_all(bind=engine)

logger = logging.getLogger("chesslens")

app = FastAPI(title="Chesslens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Last-resort handler: log the real error, send the client a safe, consistent JSON body.

    This runs outside CORSMiddleware, so without the explicit header below the browser
    would hide the 500 behind a generic "Network Error".
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins_list:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again in a moment."},
        headers=headers,
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(games.router, prefix="/games", tags=["games"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])


@app.get("/health")
def health():
    return {"status": "ok"}
