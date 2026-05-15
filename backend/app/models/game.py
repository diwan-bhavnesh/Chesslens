from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, UniqueConstraint, literal_column
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    platform = Column(String, nullable=False)
    username = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending | running | done | failed
    games_imported = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "external_id", name="uq_game_user_source_external"),
    )

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    source = Column(String, nullable=False)  # "chesscom" | "manual"
    external_id = Column(String, nullable=True)
    pgn = Column(Text, nullable=False)
    white_player = Column(String, nullable=True)
    black_player = Column(String, nullable=True)
    white_elo = Column(Integer, nullable=True)
    black_elo = Column(Integer, nullable=True)
    result = Column(String, nullable=True)  # "1-0" | "0-1" | "1/2-1/2"
    time_control = Column(String, nullable=True)
    opening = Column(String, nullable=True)
    played_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="games")
    analysis = relationship("GameAnalysis", back_populates="game", uselist=False, cascade="all, delete-orphan")
    moves = relationship("Move", back_populates="game", order_by=[literal_column("move_number").asc(), literal_column("color").desc()], cascade="all, delete-orphan")


class GameAnalysis(Base):
    __tablename__ = "game_analyses"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    game_id = Column(String(32), ForeignKey("games.id"), nullable=False, unique=True)
    accuracy_white = Column(Float, nullable=True)
    accuracy_black = Column(Float, nullable=True)
    brilliants_white = Column(Integer, default=0)
    brilliants_black = Column(Integer, default=0)
    blunders_white = Column(Integer, default=0)
    blunders_black = Column(Integer, default=0)
    mistakes_white = Column(Integer, default=0)
    mistakes_black = Column(Integer, default=0)
    inaccuracies_white = Column(Integer, default=0)
    inaccuracies_black = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending | done | failed
    claude_summary = Column(Text, nullable=True)
    key_moments = Column(JSON, nullable=True)  # [{move_number, comment, eval_change}]
    created_at = Column(DateTime, default=datetime.utcnow)

    game = relationship("Game", back_populates="analysis")


class BatchAnalysis(Base):
    __tablename__ = "batch_analyses"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending | running | done | failed
    total_games = Column(Integer, default=0)
    games_analyzed = Column(Integer, default=0)
    portfolio_data = Column(JSON, nullable=True)   # full Claude portfolio analysis
    # legacy columns kept nullable for old rows
    accuracy_trend = Column(JSON, nullable=True)
    opening_stats = Column(JSON, nullable=True)
    tactical_summary = Column(JSON, nullable=True)
    claude_insights = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Move(Base):
    __tablename__ = "moves"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    game_id = Column(String(32), ForeignKey("games.id"), nullable=False)
    move_number = Column(Integer, nullable=False)
    color = Column(String, nullable=False)  # "white" | "black"
    san = Column(String, nullable=False)
    uci = Column(String, nullable=False)
    fen_after = Column(String, nullable=False)
    eval_before = Column(Float, nullable=True)
    eval_after = Column(Float, nullable=True)
    best_move = Column(String, nullable=True)
    classification = Column(String, nullable=True)  # "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder"
    comment = Column(Text, nullable=True)

    game = relationship("Game", back_populates="moves")
