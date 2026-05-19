import chess
import chess.pgn
import io
import re
from datetime import datetime
from typing import Optional


def parse_pgn(pgn_text: str) -> Optional[chess.pgn.Game]:
    return chess.pgn.read_game(io.StringIO(pgn_text))


def classify_move(eval_loss: float) -> str:
    """Classify a move. eval_loss is in pawns (not centipawns)."""
    if eval_loss >= 2.0:
        return "blunder"
    elif eval_loss >= 1.0:
        return "mistake"
    elif eval_loss >= 0.5:
        return "inaccuracy"
    elif eval_loss <= 0.05:
        return "best"
    return "good"


def centipawns_to_display(cp: int, color: str) -> float:
    value = cp / 100.0
    return value if color == "white" else -value


def get_game_headers(game: chess.pgn.Game) -> dict:
    opening = game.headers.get("Opening")
    if not opening:
        ecurl = game.headers.get("ECOUrl", "")
        if ecurl:
            slug = ecurl.rstrip("/").split("/")[-1]
            # Strip move annotations like "-3...e6-4.Bg2" or "-4.c4-Nf6"
            opening = re.split(r'-\d+[\.\.]', slug)[0].replace("-", " ").strip() or None
    return {
        "white": game.headers.get("White", "?"),
        "black": game.headers.get("Black", "?"),
        "white_elo": _safe_int(game.headers.get("WhiteElo")),
        "black_elo": _safe_int(game.headers.get("BlackElo")),
        "result": game.headers.get("Result"),
        "time_control": game.headers.get("TimeControl"),
        "opening": opening,
        "date": game.headers.get("Date"),
        "event": game.headers.get("Event"),
    }


def extract_moves_text(pgn_text: str, max_half_moves: int = 30) -> str:
    """Return first max_half_moves half-moves as compact SAN string (e.g. '1.e4 e5 2.Nf3 Nc6')."""
    game = parse_pgn(pgn_text)
    if not game:
        return ""
    board = game.board()
    parts: list[str] = []
    count = 0
    for node in game.mainline():
        if count >= max_half_moves:
            break
        move = node.move
        if count % 2 == 0:
            parts.append(f"{count // 2 + 1}.")
        parts.append(board.san(move))
        board.push(move)
        count += 1
    return " ".join(parts)


def _safe_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value and value != "?" else None
    except (ValueError, TypeError):
        return None


def parse_clock_comment(comment: str) -> Optional[float]:
    """Extract remaining seconds from a '[%clk h:mm:ss]' PGN move comment."""
    match = re.search(r'\[%clk (\d+):(\d+):(\d+)\]', comment)
    if not match:
        return None
    h, m, s = int(match.group(1)), int(match.group(2)), int(match.group(3))
    return h * 3600 + m * 60 + s


def parse_pgn_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse a PGN Date header like '2023.01.15' into a datetime. Returns None for unknown dates."""
    if not date_str or "?" in date_str:
        return None
    try:
        return datetime.strptime(date_str.replace(".", "-"), "%Y-%m-%d")
    except ValueError:
        return None
