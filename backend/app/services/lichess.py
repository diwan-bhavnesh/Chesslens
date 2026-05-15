import httpx
from datetime import datetime
from typing import Optional

from app.config import settings

_PERF_TYPE_MAP = {
    "bullet": "bullet",
    "blitz": "blitz",
    "rapid": "rapid",
    "classical": "classical",
    "chess960": "chess960",
}


def _tc_to_seconds(tc: str) -> str:
    """Convert 'M+S' or '960_M+S' display format to Lichess PGN TimeControl format (seconds)."""
    tc = tc.replace("960_", "")
    parts = tc.split("+")
    minutes = int(parts[0])
    seconds = int(parts[1]) if len(parts) > 1 else 0
    total = minutes * 60
    return f"{total}+{seconds}"


async def fetch_player_games(
    username: str,
    max_games: int = 100,
    since_date: Optional[datetime] = None,
    game_type: str = "all",
    time_control: str = "all",
) -> list[str]:
    """Fetch games from Lichess API as PGN strings, newest first."""
    headers = {"Accept": "application/x-chess-pgn"}
    if settings.LICHESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.LICHESS_TOKEN}"

    params: dict = {"clocks": "false", "opening": "true"}
    if max_games > 0:
        params["max"] = max_games

    if since_date:
        params["since"] = int(since_date.timestamp() * 1000)

    if game_type != "all" and game_type in _PERF_TYPE_MAP:
        params["perfType"] = _PERF_TYPE_MAP[game_type]

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            f"{settings.LICHESS_BASE_URL}/games/user/{username}",
            params=params,
            headers=headers,
        )
        resp.raise_for_status()

    raw = resp.text.strip()
    if not raw:
        return []

    games = [g.strip() for g in raw.split("\n\n\n") if g.strip()]

    if time_control != "all":
        tc_seconds = _tc_to_seconds(time_control)
        filtered = []
        for pgn_text in games:
            for line in pgn_text.split("\n"):
                if line.startswith('[TimeControl "'):
                    if line.split('"')[1] == tc_seconds:
                        filtered.append(pgn_text)
                    break
        return filtered

    return games


def normalize_lichess_game(pgn_text: str) -> Optional[dict]:
    import chess.pgn
    import io

    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if not game:
        return None

    played_at = None
    date_str = game.headers.get("Date", "")
    time_str = game.headers.get("UTCTime", "")
    if date_str and "?" not in date_str:
        try:
            from datetime import datetime as dt
            date_str_clean = date_str.replace(".", "-")
            if time_str and "?" not in time_str:
                played_at = dt.strptime(f"{date_str_clean} {time_str}", "%Y-%m-%d %H:%M:%S")
            else:
                played_at = dt.strptime(date_str_clean, "%Y-%m-%d")
        except ValueError:
            pass

    return {
        "source": "lichess",
        "external_id": game.headers.get("Site", "").split("/")[-1],
        "pgn": pgn_text,
        "white_player": game.headers.get("White"),
        "black_player": game.headers.get("Black"),
        "white_elo": _safe_int(game.headers.get("WhiteElo")),
        "black_elo": _safe_int(game.headers.get("BlackElo")),
        "result": game.headers.get("Result"),
        "time_control": game.headers.get("TimeControl"),
        "opening": game.headers.get("Opening"),
        "played_at": played_at,
    }


def _safe_int(v: Optional[str]) -> Optional[int]:
    try:
        return int(v) if v and v != "?" else None
    except (ValueError, TypeError):
        return None
