import hashlib
import io
import math
from datetime import datetime
from typing import Optional

import chess
import chess.pgn
from sqlalchemy.orm import Session

from app.config import settings
from app.models.game import FenEvalCache, Game, GameAnalysis, Move, PlayerProfile


# ── Math helpers (mirrored from profile.py) ───────────────────────────────────

def _win_prob(eval_pawns: float) -> float:
    cp = eval_pawns * 100
    return 100.0 / (1.0 + math.exp(-0.00368 * cp))


def _move_accuracy(wp_loss: float) -> float:
    wp_loss = max(0.0, min(100.0, wp_loss))
    return max(0.0, min(100.0, 103.1668 * math.exp(-0.04354 * wp_loss) - 3.1668))


# ── Critical position filter ──────────────────────────────────────────────────

def _is_critical(board: chess.Board, move: chess.Move) -> bool:
    """Return True if a position is worth evaluating: capture, check, or move to attacked square."""
    if board.is_capture(move):
        return True
    # Check if the move gives check
    board.push(move)
    gives_check = board.is_check()
    board.pop()
    if gives_check:
        return True
    # Move to a square attacked by opponent's non-pawn pieces (sacrifice-candidate square)
    opponent = not board.turn
    for sq in board.attackers(opponent, move.to_square):
        piece = board.piece_at(sq)
        if piece and piece.piece_type != chess.PAWN:
            return True
    return False


# ── FEN evaluation with caching ───────────────────────────────────────────────

def _get_or_cache_eval(
    fen: str,
    engine,
    db: Session,
    seen_hashes: set,
) -> Optional[float]:
    """Return centipawn eval as pawns. Uses DB cache; falls back to Stockfish."""
    fen_hash = hashlib.md5(fen.encode()).hexdigest()

    if fen_hash not in seen_hashes:
        cached = db.query(FenEvalCache).filter(FenEvalCache.fen_hash == fen_hash).first()
        if cached:
            return cached.eval_cp / 100.0

    try:
        engine.set_fen_position(fen)
        evaluation = engine.get_evaluation()
        if evaluation["type"] == "cp":
            eval_cp = evaluation["value"]
            eval_pawns = eval_cp / 100.0
        elif evaluation["type"] == "mate":
            mate_in = evaluation["value"]
            eval_cp = 99900 if mate_in > 0 else -99900
            eval_pawns = 999.0 if mate_in > 0 else -999.0
        else:
            return None
    except Exception:
        return None

    if fen_hash not in seen_hashes:
        try:
            db.add(FenEvalCache(
                fen_hash=fen_hash,
                eval_cp=eval_cp,
                depth=settings.STOCKFISH_BULK_DEPTH,
            ))
            seen_hashes.add(fen_hash)
        except Exception:
            pass

    return eval_pawns


# ── Accuracy from move dicts ──────────────────────────────────────────────────

def _accuracy_from_dicts(moves_data: list[dict], color: str) -> Optional[float]:
    relevant = [
        m for m in moves_data
        if m["color"] == color
        and m.get("eval_before") is not None
        and m.get("eval_after") is not None
    ]
    if not relevant:
        return None
    total = 0.0
    for m in relevant:
        wp_before = _win_prob(m["eval_before"])
        wp_after = _win_prob(m["eval_after"])
        if color == "white":
            wp_loss = max(0.0, wp_before - wp_after)
        else:
            wp_loss = max(0.0, wp_after - wp_before)
        total += _move_accuracy(wp_loss)
    return round(total / len(relevant), 1)


# ── Single-game analysis ──────────────────────────────────────────────────────

def _analyze_single_game(
    game: Game,
    engine,
    db: Session,
    seen_hashes: set,
) -> None:
    """Analyze one game at bulk depth. Writes sparse Move rows + upserts GameAnalysis."""
    pgn_game = chess.pgn.read_game(io.StringIO(game.pgn))
    if not pgn_game:
        return

    board = pgn_game.board()
    move_rows: list[dict] = []
    half = 0

    for node in pgn_game.mainline():
        move = node.move
        color = "white" if board.turn == chess.WHITE else "black"
        move_number = half // 2 + 1

        # Skip opening — first 10 half-moves
        if half < 10:
            board.push(move)
            half += 1
            continue

        san = board.san(move)
        uci = move.uci()
        fen_before = board.fen()

        if _is_critical(board, move):
            eval_before = _get_or_cache_eval(fen_before, engine, db, seen_hashes)
            board.push(move)
            fen_after = board.fen()
            eval_after = _get_or_cache_eval(fen_after, engine, db, seen_hashes)

            move_rows.append({
                "move_number": move_number,
                "color": color,
                "san": san,
                "uci": uci,
                "fen_after": fen_after,
                "eval_before": eval_before,
                "eval_after": eval_after,
            })
        else:
            board.push(move)

        half += 1

    if not move_rows:
        return

    # Write sparse Move rows (critical positions only)
    for m in move_rows:
        db.add(Move(
            game_id=game.id,
            move_number=m["move_number"],
            color=m["color"],
            san=m["san"],
            uci=m["uci"],
            fen_after=m["fen_after"],
            eval_before=m["eval_before"],
            eval_after=m["eval_after"],
        ))

    # Compute per-game accuracy
    acc_white = _accuracy_from_dicts(move_rows, "white")
    acc_black = _accuracy_from_dicts(move_rows, "black")

    # Upsert GameAnalysis — never overwrite existing accuracy from depth-15 analysis
    analysis = db.query(GameAnalysis).filter(GameAnalysis.game_id == game.id).first()
    if analysis:
        if analysis.accuracy_white is None:
            analysis.accuracy_white = acc_white
        if analysis.accuracy_black is None:
            analysis.accuracy_black = acc_black
        if analysis.status != "done":
            analysis.status = "done"
    else:
        db.add(GameAnalysis(
            game_id=game.id,
            accuracy_white=acc_white,
            accuracy_black=acc_black,
            status="done",
        ))


# ── Orchestrator ──────────────────────────────────────────────────────────────

def bulk_analyze_games(user_id: str, db: Session, profile: PlayerProfile) -> None:
    """Layer 2: selective depth-1 Stockfish across all unanalyzed games."""
    from stockfish import Stockfish

    # Games already fully analyzed (depth-15 or prior bulk run) — skip these
    analyzed_ids = {
        row[0] for row in
        db.query(GameAnalysis.game_id)
        .join(Game, Game.id == GameAnalysis.game_id)
        .filter(
            Game.user_id == user_id,
            GameAnalysis.status == "done",
            GameAnalysis.accuracy_white.isnot(None),
        )
        .all()
    }

    all_games = db.query(Game).filter(Game.user_id == user_id).all()
    unanalyzed = [g for g in all_games if g.id not in analyzed_ids]

    if not unanalyzed:
        return

    # Signal Layer 2 started — frontend polls on games_total being non-null
    profile.games_total = len(unanalyzed)
    profile.games_done = 0
    db.commit()

    try:
        engine = Stockfish(path=settings.STOCKFISH_PATH, depth=settings.STOCKFISH_BULK_DEPTH)
    except Exception:
        return

    seen_hashes: set = set()

    for i, game in enumerate(unanalyzed):
        try:
            _analyze_single_game(game, engine, db, seen_hashes)
        except Exception:
            pass

        profile.games_done = i + 1
        if (i + 1) % 10 == 0:
            try:
                db.commit()
            except Exception:
                db.rollback()

    try:
        db.commit()
    except Exception:
        db.rollback()
