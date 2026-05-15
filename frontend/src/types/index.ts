export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  chesscom_username: string | null;
  created_at: string;
}

export interface Move {
  id: string;
  move_number: number;
  color: "white" | "black";
  san: string;
  uci: string;
  fen_after: string;
  eval_before: number | null;
  eval_after: number | null;
  best_move: string | null;
  classification: MoveClassification | null;
  comment: string | null;
}

export type MoveClassification =
  | "brilliant"
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface GameAnalysis {
  id: string;
  status: "pending" | "done" | "failed";
  accuracy_white: number | null;
  accuracy_black: number | null;
  brilliants_white: number;
  brilliants_black: number;
  blunders_white: number;
  blunders_black: number;
  mistakes_white: number;
  mistakes_black: number;
  inaccuracies_white: number;
  inaccuracies_black: number;
  claude_summary: string | null;
  key_moments: KeyMoment[] | null;
  created_at: string;
}

export interface MoveEntry {
  san: string;
  fen: string;
  color: "white" | "black";
  moveNumber: number;
  uci: string;
  classification: MoveClassification | null;
  eval_after: number | null;
  best_move: string | null;
  comment: string | null;
}

export interface KeyMoment {
  move_number: number;
  color: "white" | "black";
  san: string;
  classification: MoveClassification;
  eval_change: number;
}

export interface Game {
  id: string;
  source: "chesscom" | "manual";
  external_id: string | null;
  white_player: string | null;
  black_player: string | null;
  white_elo: number | null;
  black_elo: number | null;
  result: string | null;
  time_control: string | null;
  opening: string | null;
  played_at: string | null;
  created_at: string;
  analysis: GameAnalysis | null;
}

export interface GameDetail extends Game {
  pgn: string;
  moves: Move[];
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type ImportSource = "chesscom";

// ── Tier 1: Portfolio (Claude) types ─────────────────────────────────────────

export interface OpeningEntry {
  eco: string;
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TacticalPattern {
  pattern: string;
  description: string;
  frequency: "common" | "occasional" | "rare";
}

export interface OpeningRecommendation {
  name: string;
  eco: string;
  sample_moves: string;
  reason: string;
  gap_type: "repertoire_gap" | "style_match";
}

export interface PortfolioData {
  player_name: string;
  opening_repertoire: {
    as_white: OpeningEntry[];
    as_black: OpeningEntry[];
  };
  playing_style: {
    classification: "aggressive" | "defensive" | "positional" | "tactical";
    description: string;
  };
  style_evolution: {
    description: string;
    trend: string;
  };
  pawn_structures: string[];
  tactical_patterns: TacticalPattern[];
  opening_recommendations: OpeningRecommendation[];
}

export interface BatchAnalysis {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  total_games: number;
  games_analyzed: number;
  portfolio_data: PortfolioData | null;
  error: string | null;
  created_at: string;
}

// ── Legacy analytics types (kept for reference) ──────────────────────────────

export interface AccuracyPoint {
  date: string;
  game_id: string;
  accuracy_white: number | null;
  accuracy_black: number | null;
  result: string | null;
  source: string;
  time_category: string;
  opening: string;
}

export interface OpeningStat {
  opening: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  avg_accuracy: number;
}

export interface TacticalSummary {
  total_games: number;
  games_with_analysis: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  total_blunders: number;
  total_mistakes: number;
  blunders_per_game: number;
  mistakes_per_game: number;
  avg_accuracy_white: number;
  avg_accuracy_black: number;
}

export interface ClaudeInsights {
  opening_style: string;
  strengths: string;
  weaknesses: string;
  repertoire_recs: string[];
  pawn_patterns: string;
}

