from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.game import PlayerProfile
from app.models.user import User
from app.routers.deps import get_current_user
from app.services.profile import build_profile

router = APIRouter()


class PlayerProfileOut(BaseModel):
    id: str
    user_id: str
    status: str
    rating_history: Optional[list[Any]] = None
    accuracy_history: Optional[list[Any]] = None
    phase_accuracy: Optional[dict[str, Any]] = None
    time_pressure: Optional[dict[str, Any]] = None
    openings_white: Optional[list[Any]] = None
    openings_black: Optional[list[Any]] = None
    opponent_openings: Optional[list[Any]] = None
    claude_profile: Optional[dict[str, Any]] = None
    win_pct_white: Optional[float] = None
    win_pct_black: Optional[float] = None
    total_games: Optional[int] = None
    total_wins: Optional[int] = None
    total_draws: Optional[int] = None
    total_losses: Optional[int] = None
    claude_error: Optional[str] = None
    games_total: Optional[int] = None
    games_done: Optional[int] = None
    progress: Optional[str] = None
    game_count_at_last_build: Optional[int] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _upsert_and_trigger(db: Session, user_id: str, background_tasks: BackgroundTasks, force: bool = False) -> PlayerProfile:
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
    if profile and profile.status in ("pending", "running") and not force:
        raise HTTPException(status_code=409, detail="Profile build already in progress")
    now = datetime.utcnow()
    if profile:
        profile.status = "pending"
        profile.error = None
        profile.updated_at = now
    else:
        profile = PlayerProfile(user_id=user_id, status="pending", created_at=now, updated_at=now)
        db.add(profile)
    db.commit()
    db.refresh(profile)
    background_tasks.add_task(build_profile, user_id)
    return profile


@router.post("/create", response_model=PlayerProfileOut, status_code=202)
def create_profile(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _upsert_and_trigger(db, current_user.id, background_tasks, force=False)


@router.post("/rebuild", response_model=PlayerProfileOut, status_code=202)
def rebuild_profile(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # force=True: bypass the pending/running guard so an explicit rebuild always proceeds
    return _upsert_and_trigger(db, current_user.id, background_tasks, force=True)


@router.get("/me", response_model=PlayerProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found — trigger a rebuild first")
    return profile
