import math
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Optional

import chess.pgn
import io

from sqlalchemy.orm import Session

from app.models.game import Game, GameAnalysis, Move, ImportJob, PlayerProfile
from app.utils.chess import parse_clock_comment  # used by compute_time_pressure (Layer 2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _win_prob(eval_pawns: float) -> float:
    cp = eval_pawns * 100
    return 100.0 / (1.0 + math.exp(-0.00368 * cp))


def _move_accuracy(wp_loss: float) -> float:
    wp_loss = max(0.0, min(100.0, wp_loss))
    return max(0.0, min(100.0, 103.1668 * math.exp(-0.04354 * wp_loss) - 3.1668))


def _accuracy_from_moves(moves: list) -> float:
    """Compute accuracy % from a list of Move ORM objects."""
    if not moves:
        return 0.0
    total = 0.0
    for m in moves:
        eb = m.eval_before or 0.0
        ea = m.eval_after or 0.0
        wp_before = _win_prob(eb)
        wp_after = _win_prob(ea)
        if m.color == "white":
            wp_loss = max(0.0, wp_before - wp_after)
        else:
            wp_loss = max(0.0, wp_after - wp_before)
        total += _move_accuracy(wp_loss)
    return round(total / len(moves), 1)


def _username_matches(player_name: Optional[str], username: str) -> bool:
    if not player_name or not username:
        return False
    return player_name.strip().lower() == username.strip().lower()


# ── Signal extractors ─────────────────────────────────────────────────────────

def compute_chess_username(user_id: str, db: Session) -> Optional[str]:
    job = (
        db.query(ImportJob)
        .filter(ImportJob.user_id == user_id)
        .order_by(ImportJob.created_at.desc())
        .first()
    )
    return job.username if job else None


def compute_rating_history(user_id: str, username: str, db: Session) -> list[dict]:
    games = (
        db.query(Game)
        .filter(Game.user_id == user_id, Game.played_at.isnot(None))
        .order_by(Game.played_at.asc())
        .all()
    )
    result = []
    for g in games:
        if _username_matches(g.white_player, username) and g.white_elo:
            result.append({"date": g.played_at.date().isoformat(), "elo": g.white_elo, "color": "white", "time_control": g.time_control})
        elif _username_matches(g.black_player, username) and g.black_elo:
            result.append({"date": g.played_at.date().isoformat(), "elo": g.black_elo, "color": "black", "time_control": g.time_control})
    return result


def compute_accuracy_history(user_id: str, username: str, db: Session) -> list[dict]:
    rows = (
        db.query(Game, GameAnalysis)
        .join(GameAnalysis, GameAnalysis.game_id == Game.id)
        .filter(Game.user_id == user_id, GameAnalysis.status == "done", Game.played_at.isnot(None))
        .order_by(Game.played_at.asc())
        .all()
    )
    result = []
    for g, a in rows:
        if _username_matches(g.white_player, username) and a.accuracy_white is not None:
            result.append({"date": g.played_at.date().isoformat(), "accuracy": a.accuracy_white, "color": "white"})
        elif _username_matches(g.black_player, username) and a.accuracy_black is not None:
            result.append({"date": g.played_at.date().isoformat(), "accuracy": a.accuracy_black, "color": "black"})
    return result


def compute_phase_accuracy(user_id: str, db: Session) -> dict:
    # Fetch all moves for this user's games that have been analyzed
    analyzed_game_ids = [
        row[0] for row in
        db.query(GameAnalysis.game_id)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(Game.user_id == user_id, GameAnalysis.status == "done")
        .all()
    ]
    if not analyzed_game_ids:
        return {"opening": None, "middlegame": None, "endgame": None, "game_count": 0}

    all_moves = (
        db.query(Move)
        .filter(Move.game_id.in_(analyzed_game_ids))
        .all()
    )

    opening = [m for m in all_moves if m.move_number <= 10]
    middlegame = [m for m in all_moves if 11 <= m.move_number <= 30]
    endgame = [m for m in all_moves if m.move_number > 30]

    return {
        "opening": _accuracy_from_moves(opening) if opening else None,
        "middlegame": _accuracy_from_moves(middlegame) if middlegame else None,
        "endgame": _accuracy_from_moves(endgame) if endgame else None,
        "game_count": len(analyzed_game_ids),
    }


def compute_time_pressure(user_id: str, username: str, db: Session) -> dict:
    analyzed_games = (
        db.query(Game)
        .join(GameAnalysis, GameAnalysis.game_id == Game.id)
        .filter(Game.user_id == user_id, GameAnalysis.status == "done")
        .all()
    )

    normal_scores = []
    pressure_scores = []
    games_analyzed = 0

    for game in analyzed_games:
        # Determine time pressure threshold from time control (e.g. "300+5" → 300s base)
        tc = game.time_control or ""
        parts = tc.split("+")
        base_sec = int(parts[0]) if parts[0].isdigit() else 0
        threshold = max(30, base_sec * 0.1) if base_sec > 0 else 30

        # Parse [%clk] from PGN move comments
        try:
            pgn_game = chess.pgn.read_game(io.StringIO(game.pgn))
        except Exception:
            continue

        if not pgn_game:
            continue

        # Build clock map: (move_number, color) → remaining_seconds
        clock_map: dict[tuple, float] = {}
        half = 0
        for node in pgn_game.mainline():
            color = "white" if half % 2 == 0 else "black"
            move_num = half // 2 + 1
            remaining = parse_clock_comment(node.comment or "")
            if remaining is not None:
                clock_map[(move_num, color)] = remaining
            half += 1

        if not clock_map:
            continue

        # Fetch moves for this game
        moves = db.query(Move).filter(Move.game_id == game.id).all()
        if not moves:
            continue

        games_analyzed += 1
        for m in moves:
            key = (m.move_number, m.color)
            remaining = clock_map.get(key)
            if remaining is None:
                continue

            eb = m.eval_before or 0.0
            ea = m.eval_after or 0.0
            wp_before = _win_prob(eb)
            wp_after = _win_prob(ea)
            wp_loss = max(0.0, (wp_before - wp_after) if m.color == "white" else (wp_after - wp_before))
            acc = _move_accuracy(wp_loss)

            if remaining < threshold:
                pressure_scores.append(acc)
            else:
                normal_scores.append(acc)

    return {
        "normal_accuracy": round(sum(normal_scores) / len(normal_scores), 1) if normal_scores else None,
        "pressure_accuracy": round(sum(pressure_scores) / len(pressure_scores), 1) if pressure_scores else None,
        "threshold_seconds": 30,
        "games_analyzed": games_analyzed,
    }


def compute_opening_stats(user_id: str, username: str, db: Session) -> tuple[list, list]:
    games = (
        db.query(Game)
        .filter(Game.user_id == user_id, Game.opening.isnot(None))
        .all()
    )

    white_map: dict[str, dict] = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})
    black_map: dict[str, dict] = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})

    for g in games:
        name = g.opening
        if _username_matches(g.white_player, username):
            bucket = white_map[name]
            bucket["games"] += 1
            if g.result == "1-0":   bucket["wins"] += 1
            elif g.result == "0-1": bucket["losses"] += 1
            else:                   bucket["draws"] += 1
        elif _username_matches(g.black_player, username):
            bucket = black_map[name]
            bucket["games"] += 1
            if g.result == "0-1":   bucket["wins"] += 1
            elif g.result == "1-0": bucket["losses"] += 1
            else:                   bucket["draws"] += 1

    def to_list(m: dict, limit: int = 5) -> list:
        rows = [{"name": k, **v} for k, v in m.items()]
        return sorted(rows, key=lambda x: x["games"], reverse=True)[:limit]

    return to_list(white_map), to_list(black_map)


def compute_win_pct(user_id: str, username: str, db: Session) -> tuple:
    games = db.query(Game).filter(Game.user_id == user_id, Game.result.isnot(None)).all()
    white_wins = white_total = black_wins = black_total = 0
    total_wins = total_draws = total_losses = 0
    for g in games:
        if _username_matches(g.white_player, username):
            white_total += 1
            if g.result == "1-0":
                white_wins += 1
                total_wins += 1
            elif g.result == "0-1":
                total_losses += 1
            else:
                total_draws += 1
        elif _username_matches(g.black_player, username):
            black_total += 1
            if g.result == "0-1":
                black_wins += 1
                total_wins += 1
            elif g.result == "1-0":
                total_losses += 1
            else:
                total_draws += 1
    win_pct_white = round((white_wins / white_total) * 100, 1) if white_total > 0 else None
    win_pct_black = round((black_wins / black_total) * 100, 1) if black_total > 0 else None
    return win_pct_white, win_pct_black, total_wins, total_draws, total_losses


def compute_opponent_openings(user_id: str, username: str, db: Session) -> list:
    games = (
        db.query(Game)
        .filter(Game.user_id == user_id, Game.opening.isnot(None))
        .all()
    )

    opp_map: dict[str, dict] = defaultdict(lambda: {"times_faced": 0, "wins": 0, "draws": 0, "losses": 0})

    for g in games:
        name = g.opening
        if _username_matches(g.white_player, username):
            # User was white — opponent played what the opening led to from black's side
            b = opp_map[name]
            b["times_faced"] += 1
            if g.result == "1-0":   b["wins"] += 1
            elif g.result == "0-1": b["losses"] += 1
            else:                   b["draws"] += 1
        elif _username_matches(g.black_player, username):
            b = opp_map[name]
            b["times_faced"] += 1
            if g.result == "0-1":   b["wins"] += 1
            elif g.result == "1-0": b["losses"] += 1
            else:                   b["draws"] += 1

    rows = [{"name": k, **v} for k, v in opp_map.items()]
    return sorted(rows, key=lambda x: x["times_faced"], reverse=True)[:5]


def _rating_range(history: list) -> dict:
    elos = [p["elo"] for p in history if p.get("elo", 0) > 0]
    if not elos:
        return {}
    return {"min": min(elos), "max": max(elos), "latest": elos[-1]}


# ── Orchestrator ──────────────────────────────────────────────────────────────

def build_profile(user_id: str) -> None:
    from app.database import SessionLocal
    from app.services import claude as cl

    db = SessionLocal()
    try:
        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
        if not profile:
            return

        profile.status = "running"
        db.commit()

        username = compute_chess_username(user_id, db) or ""

        rating_history = compute_rating_history(user_id, username, db)
        openings_white, openings_black = compute_opening_stats(user_id, username, db)
        opponent_openings = compute_opponent_openings(user_id, username, db)
        win_pct_white, win_pct_black, total_wins, total_draws, total_losses = compute_win_pct(user_id, username, db)

        # Build compact summary for Claude (Layer 1 data only)
        total_games = db.query(Game).filter(Game.user_id == user_id).count()

        structured_data = {
            "player_name": username,
            "total_games": total_games,
            "win_pct_white": win_pct_white,
            "win_pct_black": win_pct_black,
            "openings_white": openings_white,
            "openings_black": openings_black,
            "opponent_openings": opponent_openings,
            "rating_range": _rating_range(rating_history),
        }

        # Save Layer 1 data; explicitly null out any stale Layer 2 data from previous runs
        profile.rating_history = rating_history
        profile.openings_white = openings_white
        profile.openings_black = openings_black
        profile.opponent_openings = opponent_openings
        profile.win_pct_white = win_pct_white
        profile.win_pct_black = win_pct_black
        profile.total_games = total_games
        profile.total_wins = total_wins
        profile.total_draws = total_draws
        profile.total_losses = total_losses
        profile.accuracy_history = None
        profile.phase_accuracy = None
        profile.time_pressure = None
        profile.claude_error = None
        profile.status = "done"
        profile.updated_at = datetime.utcnow()
        db.commit()

        try:
            profile.claude_profile = cl.synthesize_player_profile(structured_data)
            profile.updated_at = datetime.utcnow()
            db.commit()
        except Exception as ce:
            profile.claude_error = str(ce)[:200]
            db.commit()

        # Snapshot game count so frontend knows when new games have been imported
        profile.game_count_at_last_build = total_games
        db.commit()

        # ── Layer 2: bulk accuracy (background, non-fatal) ─────────────────
        try:
            from app.services.bulk_analysis import bulk_analyze_games
            bulk_analyze_games(user_id, db, profile)
            profile.accuracy_history = compute_accuracy_history(user_id, username, db)
            profile.phase_accuracy = compute_phase_accuracy(user_id, db)
            profile.time_pressure = compute_time_pressure(user_id, username, db)
            profile.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            pass

    except Exception as e:
        db.rollback()
        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
        if profile:
            profile.status = "failed"
            profile.error = str(e)[:500]
            db.commit()
    finally:
        db.close()
