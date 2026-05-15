import httpx
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

_HEADERS = {"User-Agent": "Chesslens/1.0"}


def _tc_to_seconds(tc: str) -> str:
    """Convert 'M+S' or '960_M+S' display format to Chess.com's seconds-based format."""
    tc = tc.replace("960_", "")
    parts = tc.split("+")
    minutes = int(parts[0])
    seconds = int(parts[1]) if len(parts) > 1 else 0
    total = minutes * 60
    return f"{total}+{seconds}" if seconds else str(total)


async def fetch_player_games(
    username: str,
    max_games: int = 100,
    since_date: Optional[datetime] = None,
    game_type: str = "all",
    time_control: str = "all",
) -> list[dict]:
    """Fetch games from Chess.com, walking monthly archives newest-first until limit is reached."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        archives_resp = await client.get(
            f"{settings.CHESSCOM_BASE_URL}/player/{username}/games/archives",
            headers=_HEADERS,
        )
        archives_resp.raise_for_status()
        archives = archives_resp.json().get("archives", [])

        if not archives:
            return []

        collected: list[dict] = []
        tc_seconds = _tc_to_seconds(time_control) if time_control != "all" else ""

        for archive_url in reversed(archives):
            # Archive URLs end in /YYYY/MM — stop once we pass the since_date
            if since_date:
                parts = archive_url.rstrip("/").split("/")
                year, month = int(parts[-2]), int(parts[-1])
                archive_date = datetime(year, month, 1, tzinfo=timezone.utc)
                if archive_date < since_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0):
                    break

            games_resp = await client.get(archive_url, headers=_HEADERS)
            games_resp.raise_for_status()
            month_games = games_resp.json().get("games", [])

            for g in reversed(month_games):  # newest first within archive
                # Per-game date check (archive filtering already excludes old months,
                # but within the boundary month we need exact filtering)
                if since_date:
                    end_time = g.get("end_time")
                    if end_time:
                        game_dt = datetime.fromtimestamp(end_time, tz=timezone.utc)
                        if game_dt < since_date:
                            break  # games are newest-first, so all remaining are older

                if game_type != "all":
                    if game_type == "chess960":
                        if g.get("rules") != "chess960":
                            continue
                    else:
                        if g.get("time_class") != game_type or g.get("rules", "chess") != "chess":
                            continue

                if tc_seconds and g.get("time_control") != tc_seconds:
                    continue

                collected.append(g)
                if max_games > 0 and len(collected) >= max_games:
                    break

            if max_games > 0 and len(collected) >= max_games:
                break

        return collected


def normalize_chesscom_game(raw: dict) -> dict:
    played_at = None
    end_time = raw.get("end_time")
    if end_time:
        played_at = datetime.fromtimestamp(end_time, tz=timezone.utc).replace(tzinfo=None)

    return {
        "source": "chesscom",
        "external_id": str(raw.get("uuid", "")),
        "pgn": raw.get("pgn", ""),
        "white_player": raw.get("white", {}).get("username"),
        "black_player": raw.get("black", {}).get("username"),
        "white_elo": raw.get("white", {}).get("rating"),
        "black_elo": raw.get("black", {}).get("rating"),
        "result": _parse_result(raw.get("white", {}).get("result"), raw.get("black", {}).get("result")),
        "time_control": raw.get("time_control"),
        "played_at": played_at,
    }


def _parse_result(white_result: Optional[str], black_result: Optional[str]) -> Optional[str]:
    if white_result == "win":
        return "1-0"
    if black_result == "win":
        return "0-1"
    if white_result in ("agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"):
        return "1/2-1/2"
    return None
