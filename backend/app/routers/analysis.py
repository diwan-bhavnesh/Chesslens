from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional
import uuid
from datetime import datetime


def _gid(game_id: str) -> str:
    try:
        return uuid.UUID(game_id).hex
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")


from app.database import get_db
from app.models.game import Game, GameAnalysis, Move, BatchAnalysis
from app.models.user import User
from app.routers.deps import get_current_user
from app.schemas.game import GameAnalysisOut
from app.services import stockfish as sf, claude as cl

router = APIRouter()


# ── Batch analysis schemas ──────────────────────────────────────────────────

class BatchAnalysisOut(BaseModel):
    id: uuid.UUID
    status: str
    total_games: int
    games_analyzed: int
    portfolio_data: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Batch endpoints — before /{game_id} to avoid route shadowing ────────────

@router.post("/batch", response_model=BatchAnalysisOut, status_code=202)
def trigger_batch_analysis(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(BatchAnalysis)
        .filter(BatchAnalysis.user_id == current_user.id)
        .order_by(BatchAnalysis.created_at.desc())
        .first()
    )
    if existing and existing.status in ("pending", "running"):
        raise HTTPException(status_code=409, detail="Analysis already in progress")

    total = db.query(Game).filter(Game.user_id == current_user.id).count()
    batch = BatchAnalysis(user_id=current_user.id, total_games=total)
    db.add(batch)
    db.commit()
    db.refresh(batch)

    background_tasks.add_task(_run_batch_analysis, batch.id, current_user.id)
    return batch


@router.get("/batch/latest", response_model=BatchAnalysisOut)
def get_latest_batch_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = (
        db.query(BatchAnalysis)
        .filter(BatchAnalysis.user_id == current_user.id)
        .order_by(BatchAnalysis.created_at.desc())
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="No batch analysis found")
    return batch


# ── Per-game (Tier 2 — Stockfish deep dive) ─────────────────────────────────

@router.post("/{game_id}", response_model=GameAnalysisOut, status_code=202)
def trigger_analysis(
    game_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gid = _gid(game_id)
    game = db.query(Game).filter(Game.id == gid, Game.user_id == current_user.id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.analysis:
        if game.analysis.status == "pending":
            return game.analysis  # already queued, don't duplicate
        if game.analysis.status == "done":
            # Skip re-analysis if already at depth-15 (any move has best_move stored)
            already_deep = db.query(Move).filter(
                Move.game_id == gid, Move.best_move.isnot(None)
            ).first() is not None
            if already_deep:
                return game.analysis
        db.delete(game.analysis)
        db.commit()

    background_tasks.add_task(_run_analysis, game_id=gid)
    placeholder = GameAnalysis(game_id=gid)
    db.add(placeholder)
    db.commit()
    db.refresh(placeholder)
    return placeholder


@router.get("/{game_id}", response_model=GameAnalysisOut)
def get_analysis(
    game_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gid = _gid(game_id)
    game = db.query(Game).filter(Game.id == gid, Game.user_id == current_user.id).first()
    if not game or not game.analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return game.analysis


# ── Tier 1 background task: Claude portfolio analysis ───────────────────────

def _run_batch_analysis(batch_id: str, user_id: str):
    from app.database import SessionLocal
    from app.utils.chess import extract_moves_text

    db = SessionLocal()
    try:
        batch = db.query(BatchAnalysis).filter(BatchAnalysis.id == batch_id).first()
        batch.status = "running"
        db.commit()

        games = db.query(Game).filter(Game.user_id == user_id).order_by(Game.played_at).all()

        games_data = []
        for g in games:
            tc = g.time_control or ""
            parts = tc.split("+")
            base = int(parts[0]) if parts[0].isdigit() else 0
            inc  = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
            total_sec = base + inc * 40
            if   total_sec < 180:  time_cat = "bullet"
            elif total_sec < 480:  time_cat = "blitz"
            elif total_sec < 1500: time_cat = "rapid"
            elif total_sec > 0:    time_cat = "classical"
            else:                  time_cat = "other"

            games_data.append({
                "white_player": g.white_player,
                "black_player": g.black_player,
                "result": g.result,
                "played_at": g.played_at.isoformat() if g.played_at else None,
                "source": g.source,
                "time_category": time_cat,
                "opening": g.opening,
                "moves_text": extract_moves_text(g.pgn, max_half_moves=30),
            })

        portfolio_data = cl.analyze_portfolio(games_data)

        batch.portfolio_data = portfolio_data
        batch.total_games = len(games)
        batch.games_analyzed = len(games)
        batch.status = "done"
        db.commit()

    except Exception as e:
        db.rollback()
        batch = db.query(BatchAnalysis).filter(BatchAnalysis.id == batch_id).first()
        if batch:
            batch.status = "failed"
            batch.error = str(e)[:500]
            db.commit()
    finally:
        db.close()


# ── Tier 2 background task: Stockfish deep dive ─────────────────────────────

def _run_analysis(game_id: str):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            return

        move_data = sf.analyze_game(game.pgn)

        for m in move_data:
            move = Move(game_id=game.id, **m)
            db.add(move)

        def count(color, cls):
            return sum(1 for m in move_data if m["color"] == color and m.get("classification") == cls)

        accuracy_w = _compute_accuracy(move_data, "white")
        accuracy_b = _compute_accuracy(move_data, "black")

        # Critical moments: eval drop > 150cp (1.5 pawns) for the moving side
        key_moments = []
        for m in move_data:
            before = m.get("eval_before") or 0.0
            after  = m.get("eval_after") or 0.0
            drop = (before - after) if m["color"] == "white" else (after - before)
            if drop >= 1.5:
                key_moments.append({
                    "move_number": m["move_number"],
                    "color": m["color"],
                    "san": m["san"],
                    "classification": m["classification"],
                    "eval_drop": round(drop, 2),
                    "best_move": m.get("best_move"),
                    "eval_before": before,
                    "eval_after": after,
                })
        key_moments = key_moments[:10]

        summary = None
        try:
            game_meta = {
                "white_player": game.white_player,
                "black_player": game.black_player,
                "result": game.result,
                "opening": game.opening,
            }
            summary = cl.generate_game_summary(move_data, game_meta)
        except Exception:
            pass

        analysis = db.query(GameAnalysis).filter(GameAnalysis.game_id == game_id).first()
        if analysis:
            analysis.status = "done"
            analysis.accuracy_white = accuracy_w
            analysis.accuracy_black = accuracy_b
            analysis.brilliants_white = count("white", "brilliant")
            analysis.brilliants_black = count("black", "brilliant")
            analysis.blunders_white = count("white", "blunder")
            analysis.blunders_black = count("black", "blunder")
            analysis.mistakes_white = count("white", "mistake")
            analysis.mistakes_black = count("black", "mistake")
            analysis.inaccuracies_white = count("white", "inaccuracy")
            analysis.inaccuracies_black = count("black", "inaccuracy")
            analysis.claude_summary = summary
            analysis.key_moments = key_moments
            db.commit()
    except Exception:
        analysis = db.query(GameAnalysis).filter(GameAnalysis.game_id == game_id).first()
        if analysis:
            analysis.status = "failed"
            db.commit()
    finally:
        db.close()


def _win_prob(eval_pawns: float) -> float:
    """Eval in pawns → win probability for white, 0–100."""
    import math
    cp = eval_pawns * 100
    return 100.0 / (1.0 + math.exp(-0.00368 * cp))


def _move_accuracy(wp_loss: float) -> float:
    """Lichess/Chess.com formula: win-probability loss (pp) → move accuracy 0–100."""
    import math
    wp_loss = max(0.0, min(100.0, wp_loss))
    return max(0.0, min(100.0, 103.1668 * math.exp(-0.04354 * wp_loss) - 3.1668))


def _compute_accuracy(moves: list[dict], color: str) -> float:
    # Skip opening (move_number ≤ 5 = first 10 half-moves), consistent with bulk analysis.
    # Skip moves where either eval is None (Stockfish failed on that position).
    color_moves = [
        m for m in moves
        if m["color"] == color
        and m.get("move_number", 0) > 5
        and m.get("eval_before") is not None
        and m.get("eval_after") is not None
    ]
    if not color_moves:
        return 0.0
    total = 0.0
    for m in color_moves:
        eb = m["eval_before"]
        ea = m["eval_after"]
        wp_before = _win_prob(eb)
        wp_after  = _win_prob(ea)
        if color == "white":
            wp_loss = max(0.0, wp_before - wp_after)
        else:
            wp_loss = max(0.0, wp_after - wp_before)
        total += _move_accuracy(wp_loss)
    return round(total / len(color_moves), 1)
