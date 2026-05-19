from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.game import Game, ImportJob, PlayerProfile
from app.routers.deps import get_current_user
from app.schemas.game import GameDetailOut, GameImportRequest, GameOut, ImportJobOut, PGNImportRequest
from app.services import chesscom
from app.utils.chess import parse_pgn, get_game_headers, parse_pgn_date

router = APIRouter()


def _gid(game_id: str) -> str:
    try:
        return uuid.UUID(game_id).hex
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")


def _parse_date_range(date_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {
        "15d": timedelta(days=15),
        "1m":  timedelta(days=30),
        "2m":  timedelta(days=60),
        "3m":  timedelta(days=90),
        "6m":  timedelta(days=180),
        "1y":  timedelta(days=365),
    }
    delta = mapping.get(date_range)
    return now - delta if delta else None


@router.get("/", response_model=list[GameOut])
def list_games(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func, case
    return (
        db.query(Game)
        .filter(Game.user_id == current_user.id)
        .order_by(func.coalesce(Game.played_at, Game.created_at).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.delete("/all", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Game).filter(Game.user_id == current_user.id).delete()
    db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).delete()
    db.commit()


# Must be defined before /{game_id} to avoid route shadowing
@router.get("/import/jobs/{job_id}", response_model=ImportJobOut)
def get_import_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        jid = uuid.UUID(job_id).hex
    except ValueError:
        raise HTTPException(status_code=404, detail="Job not found")
    job = db.query(ImportJob).filter(
        ImportJob.id == jid,
        ImportJob.user_id == current_user.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{game_id}", response_model=GameDetailOut)
def get_game(
    game_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    game = db.query(Game).filter(Game.id == _gid(game_id), Game.user_id == current_user.id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(
    game_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    game = db.query(Game).filter(Game.id == _gid(game_id), Game.user_id == current_user.id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    db.delete(game)
    db.commit()


@router.post("/import/pgn", response_model=GameOut, status_code=status.HTTP_201_CREATED)
def import_pgn(
    payload: PGNImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    parsed = parse_pgn(payload.pgn)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid PGN")
    headers = get_game_headers(parsed)
    game = Game(
        user_id=current_user.id,
        source="manual",
        pgn=payload.pgn,
        white_player=headers["white"],
        black_player=headers["black"],
        white_elo=headers["white_elo"],
        black_elo=headers["black_elo"],
        result=headers["result"],
        time_control=headers["time_control"],
        opening=headers["opening"],
        played_at=parse_pgn_date(headers.get("date")),
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


@router.post("/import/{platform}", response_model=ImportJobOut, status_code=status.HTTP_202_ACCEPTED)
async def import_games(
    platform: str,
    payload: GameImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if platform not in ("chesscom",):
        raise HTTPException(status_code=400, detail="Unknown platform. Use 'chesscom'.")
    if not payload.username or not payload.username.strip():
        raise HTTPException(status_code=422, detail="Username cannot be empty.")

    job = ImportJob(
        user_id=current_user.id,
        platform=platform,
        username=payload.username,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import, job.id, current_user.id, platform, payload)
    return job


async def _run_import(job_id: str, user_id: str, platform: str, payload: GameImportRequest):
    db = SessionLocal()
    job = None
    try:
        job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
        job.status = "running"
        db.commit()

        since_date = _parse_date_range(payload.date_range)

        # Load existing external_ids to skip duplicates without relying on the DB constraint
        existing_ids: set[str] = {
            row[0]
            for row in db.query(Game.external_id)
            .filter(Game.user_id == user_id, Game.source == platform, Game.external_id.isnot(None))
            .all()
        }

        saved_count = 0

        if platform == "chesscom":
            raw_games = await chesscom.fetch_player_games(
                payload.username, payload.max_games, since_date, payload.game_type, payload.time_control
            )
            for raw in raw_games:
                normalized = chesscom.normalize_chesscom_game(raw)
                if not normalized["pgn"]:
                    continue
                ext_id = normalized.get("external_id") or ""
                if ext_id and ext_id in existing_ids:
                    continue
                parsed = parse_pgn(normalized["pgn"])
                headers = get_game_headers(parsed) if parsed else {}
                game = Game(user_id=user_id, **normalized, opening=headers.get("opening"))
                db.add(game)
                if ext_id:
                    existing_ids.add(ext_id)
                saved_count += 1
                if saved_count % 50 == 0:
                    db.commit()
                    job.games_imported = saved_count
                    db.commit()

        db.commit()
        job.status = "done"
        job.games_imported = saved_count
        db.commit()

    except Exception as e:
        try:
            db.rollback()
            if job:
                job.status = "failed"
                job.error = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
