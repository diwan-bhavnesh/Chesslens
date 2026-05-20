from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel
import uuid


class GameImportRequest(BaseModel):
    source: str  # "chesscom"
    username: str
    max_games: int = 100
    date_range: str = "all"   # "3m" | "6m" | "1y" | "all"
    game_type: str = "all"    # "all" | "bullet" | "blitz" | "rapid" | "classical" | "chess960"
    time_control: str = "all"


class ImportJobOut(BaseModel):
    id: uuid.UUID
    platform: str
    username: str
    status: str
    games_imported: int
    error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PGNImportRequest(BaseModel):
    pgn: str


class MoveOut(BaseModel):
    id: uuid.UUID
    move_number: int
    color: str
    san: str
    uci: str
    fen_after: str
    eval_before: Optional[float] = None
    eval_after: Optional[float] = None
    best_move: Optional[str] = None
    classification: Optional[str] = None
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class GameAnalysisOut(BaseModel):
    id: uuid.UUID
    status: str = "pending"
    accuracy_white: Optional[float] = None
    accuracy_black: Optional[float] = None
    brilliants_white: int = 0
    brilliants_black: int = 0
    blunders_white: int = 0
    blunders_black: int = 0
    mistakes_white: int = 0
    mistakes_black: int = 0
    inaccuracies_white: int = 0
    inaccuracies_black: int = 0
    claude_summary: Optional[str] = None
    key_moments: Optional[list[dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GameOut(BaseModel):
    id: uuid.UUID
    source: str
    external_id: Optional[str] = None
    white_player: Optional[str] = None
    black_player: Optional[str] = None
    white_elo: Optional[int] = None
    black_elo: Optional[int] = None
    result: Optional[str] = None
    time_control: Optional[str] = None
    variant: Optional[str] = None
    opening: Optional[str] = None
    played_at: Optional[datetime] = None
    created_at: datetime
    analysis: Optional[GameAnalysisOut] = None

    class Config:
        from_attributes = True


class GameDetailOut(GameOut):
    pgn: str
    moves: list[MoveOut] = []
