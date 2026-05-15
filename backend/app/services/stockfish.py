from typing import Optional
import chess
import chess.pgn
from stockfish import Stockfish

from app.config import settings
from app.utils.chess import classify_move


def get_engine() -> Stockfish:
    return Stockfish(path=settings.STOCKFISH_PATH, depth=settings.STOCKFISH_DEPTH)


def analyze_game(pgn_text: str) -> list[dict]:
    """Return per-move analysis: eval, best move, classification."""
    import io
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if not game:
        return []

    engine = get_engine()
    board = game.board()
    results = []
    half_move = 0  # 0-based ply counter

    for node in game.mainline():
        move = node.move
        color = "white" if board.turn == chess.WHITE else "black"
        chess_move_number = half_move // 2 + 1  # 1,1,2,2,3,3...
        fen_before = board.fen()
        san = board.san(move)  # compute before push

        engine.set_fen_position(fen_before)
        eval_before = _get_eval(engine)

        board.push(move)
        half_move += 1
        fen_after = board.fen()

        if board.is_checkmate():
            eval_after = 999.0 if color == "white" else -999.0
            best_move_uci = None
        else:
            engine.set_fen_position(fen_after)
            eval_after = _get_eval(engine)
            best_move_uci = engine.get_best_move()

        # Compute eval loss from the moving side's perspective
        if color == "white":
            eval_loss = (eval_before or 0) - (eval_after or 0)
        else:
            eval_loss = (eval_after or 0) - (eval_before or 0)

        classification = classify_move(max(0, eval_loss))

        # Brilliant: near-best move (<=10cp loss) that sacrifices a piece to an attacked square
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
            "fen_after": fen_after,
            "eval_before": eval_before,
            "eval_after": eval_after,
            "best_move": best_move_uci,
            "classification": classification,
        })

    return results


def _get_eval(engine: Stockfish) -> Optional[float]:
    evaluation = engine.get_evaluation()
    if evaluation["type"] == "cp":
        return evaluation["value"] / 100.0
    elif evaluation["type"] == "mate":
        mate_in = evaluation["value"]
        return 999.0 if mate_in > 0 else -999.0
    return None
