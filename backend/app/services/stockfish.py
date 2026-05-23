from typing import Optional
import chess
import chess.engine
import chess.pgn

from app.config import settings
from app.utils.chess import classify_move


def analyze_game(pgn_text: str) -> list[dict]:
    """Return per-move analysis: eval, best move, classification.

    Uses chess.engine (one search per position gives both eval + best move)
    and a chain model (eval_before = prev eval_after, eliminates bootstrap
    calls after the first move).  Net: ~1 search/move vs the old 3.
    """
    import io
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if not game:
        return []

    results = []

    with chess.engine.SimpleEngine.popen_uci(settings.STOCKFISH_PATH) as engine:
        board = game.board()
        half_move = 0
        prev_eval: Optional[float] = None  # chain: last known eval from white's perspective

        for node in game.mainline():
            move = node.move
            color = "white" if board.turn == chess.WHITE else "black"
            chess_move_number = half_move // 2 + 1
            san = board.san(move)

            # Bootstrap: evaluate fen_before only for the very first move.
            # All subsequent moves reuse the previous position's eval_after.
            if prev_eval is None:
                info_before = engine.analyse(board, chess.engine.Limit(depth=settings.STOCKFISH_DEPTH))
                eval_before = _parse_score(info_before["score"])
            else:
                eval_before = prev_eval

            board.push(move)
            half_move += 1

            if board.is_checkmate():
                eval_after = 999.0 if color == "white" else -999.0
                best_move_uci = None
            else:
                # One search yields both eval and best move
                info_after = engine.analyse(board, chess.engine.Limit(depth=settings.STOCKFISH_DEPTH))
                eval_after = _parse_score(info_after["score"])
                pv = info_after.get("pv")
                best_move_uci = pv[0].uci() if pv else None

            prev_eval = eval_after  # advance chain (None propagates → re-bootstrap next move)

            # Eval loss from the moving side's perspective (both evals are white-absolute)
            if color == "white":
                eval_loss = (eval_before or 0) - (eval_after or 0)
            else:
                eval_loss = (eval_after or 0) - (eval_before or 0)

            classification = classify_move(max(0, eval_loss))

            # Brilliant: near-best move (≤0.1 pawn loss) that places a piece on an attacked square
            if max(0, eval_loss) <= 0.1:
                piece = board.piece_at(move.to_square)
                if piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN):
                    if board.is_attacked_by(board.turn, move.to_square):
                        classification = "brilliant"

            results.append({
                "move_number": chess_move_number,
                "color": color,
                "san": san,
                "uci": move.uci(),
                "fen_after": board.fen(),
                "eval_before": eval_before,
                "eval_after": eval_after,
                "best_move": best_move_uci,
                "classification": classification,
            })

    return results


def _parse_score(score: chess.engine.PovScore) -> Optional[float]:
    """Convert PovScore to pawns from white's absolute perspective."""
    white_score = score.white()
    if white_score.is_mate():
        mate = white_score.mate()
        return 999.0 if (mate is not None and mate > 0) else -999.0
    cp = white_score.score()
    return cp / 100.0 if cp is not None else None
