import json
import anthropic

from app.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Tier 1: Portfolio analysis ─────────────────────────────────────────────────

def analyze_portfolio(games_data: list[dict]) -> dict:
    """
    Send all games to Claude for a single-shot portfolio analysis.
    games_data: list of {white_player, black_player, result, played_at,
                         source, time_category, opening, moves_text}
    """
    n = len(games_data)

    lines = []
    for i, g in enumerate(games_data, 1):
        date = (g.get("played_at") or "")[:10] or "?"
        header = (
            f"[{i}] {g.get('white_player') or '?'} vs {g.get('black_player') or '?'}"
            f" | {g.get('result') or '*'} | {g.get('time_category') or '?'} | {date}"
        )
        if g.get("opening"):
            header += f" | {g['opening']}"
        if g.get("moves_text"):
            header += f"\n{g['moves_text']}"
        lines.append(header)

    games_block = "\n".join(lines)

    prompt = f"""You are analyzing {n} chess games for a single player. Identify the player as whoever appears most frequently across all games.

GAMES:
{games_block}

Return ONLY this JSON object — no markdown, no commentary:
{{
  "player_name": "identified player username",
  "opening_repertoire": {{
    "as_white": [
      {{"eco": "C60", "name": "Ruy Lopez", "games": 5, "wins": 3, "draws": 1, "losses": 1}}
    ],
    "as_black": [
      {{"eco": "B20", "name": "Sicilian Defense", "games": 8, "wins": 4, "draws": 2, "losses": 2}}
    ]
  }},
  "playing_style": {{
    "classification": "aggressive",
    "description": "1-2 sentence description of their playing style."
  }},
  "style_evolution": {{
    "description": "How their style has changed over the games chronologically, if detectable.",
    "trend": "consistent"
  }},
  "pawn_structures": [
    "Comfortable with the isolated queen's pawn, using it to generate central activity.",
    "Tends to trade doubled pawns early rather than defend them."
  ],
  "tactical_patterns": [
    {{"pattern": "Back rank weakness", "description": "Recurring oversight of back-rank mating threats in the endgame.", "frequency": "common"}},
    {{"pattern": "Knight outpost neglect", "description": "Often allows opponent knights to settle on strong central outposts.", "frequency": "occasional"}}
  ],
  "opening_recommendations": [
    {{
      "name": "Nimzo-Indian Defense",
      "eco": "E20",
      "sample_moves": "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4",
      "reason": "Matches your positional style and pawn structure comfort.",
      "gap_type": "style_match"
    }},
    {{
      "name": "English Opening",
      "eco": "A10",
      "sample_moves": "1.c4 e5 2.Nc3 Nf6 3.Nf3 Nc6",
      "reason": "Fills a White repertoire gap and fits your flexible pawn structures.",
      "gap_type": "repertoire_gap"
    }},
    {{
      "name": "King's Indian Attack",
      "eco": "A07",
      "sample_moves": "1.Nf3 d5 2.g3 Nf6 3.Bg2 e6 4.0-0",
      "reason": "Consistent setup that avoids sharp theory and suits patient play.",
      "gap_type": "style_match"
    }}
  ]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ── Tier 2: Per-game summary (used from game review page) ─────────────────────

def generate_game_summary(moves: list[dict], game_meta: dict) -> str:
    white = game_meta.get("white_player", "White")
    black = game_meta.get("black_player", "Black")
    result = game_meta.get("result", "*")
    opening = game_meta.get("opening", "Unknown opening")

    blunders_w = sum(1 for m in moves if m["color"] == "white" and m.get("classification") == "blunder")
    blunders_b = sum(1 for m in moves if m["color"] == "black" and m.get("classification") == "blunder")
    mistakes_w = sum(1 for m in moves if m["color"] == "white" and m.get("classification") == "mistake")
    mistakes_b = sum(1 for m in moves if m["color"] == "black" and m.get("classification") == "mistake")

    key_moments = [m for m in moves if m.get("classification") in ("blunder", "mistake")][:5]
    moments_text = "\n".join(
        f"- Move {m['move_number']} ({m['color']}): {m['san']} [{m['classification']}], eval change: {_eval_change(m):.1f}"
        for m in key_moments
    )

    prompt = f"""You are a chess coach analyzing a game. Provide a concise, insightful review.

Game: {white} vs {black}, Result: {result}
Opening: {opening}
White blunders: {blunders_w}, mistakes: {mistakes_w}
Black blunders: {blunders_b}, mistakes: {mistakes_b}

Key moments:
{moments_text or "No major errors"}

Write 3-4 paragraphs covering:
1. Game flow and opening
2. Critical turning points
3. What each side did well and poorly
4. Key lessons to take away

Be specific, educational, and encouraging."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def synthesize_player_profile(structured_data: dict) -> dict:
    """
    Layer 1 profile synthesis — based on openings, win rates, and rating trajectory only.
    structured_data: {player_name, total_games, win_pct_white, win_pct_black,
                      openings_white, openings_black, opponent_openings, rating_range}
    """
    openings_w = structured_data.get("openings_white") or []
    openings_b = structured_data.get("openings_black") or []
    opp_openings = structured_data.get("opponent_openings") or []
    rr = structured_data.get("rating_range") or {}

    def fmt_openings(lst: list) -> str:
        if not lst:
            return "not enough data"
        return ", ".join(
            f"{o['name']} ({o['games']}G {o['wins']}W {o['losses']}L)" for o in lst[:4]
        )

    def fmt_opp(lst: list) -> str:
        if not lst:
            return "not enough data"
        return ", ".join(f"{o['name']} ({o['times_faced']} times, {o['wins']}W)" for o in lst[:3])

    rating_str = (
        f"Current {rr.get('latest', 'unknown')} | Range {rr.get('min', '?')}–{rr.get('max', '?')}"
        if rr else "unknown"
    )
    wp_w = f"{structured_data.get('win_pct_white', 0):.1f}%" if structured_data.get('win_pct_white') is not None else "unknown"
    wp_b = f"{structured_data.get('win_pct_black', 0):.1f}%" if structured_data.get('win_pct_black') is not None else "unknown"

    prompt = f"""You are a chess coach generating a player profile. Base your analysis entirely on the opening repertoire and win rates provided — no engine data is available yet.

PLAYER: {structured_data.get('player_name', 'the player')}
STATS:
- Total games: {structured_data.get('total_games', 0)}
- Win rate as White: {wp_w} | Win rate as Black: {wp_b}
- Rating: {rating_str}
- Openings as White: {fmt_openings(openings_w)}
- Openings as Black: {fmt_openings(openings_b)}
- Most-faced opponent openings: {fmt_opp(opp_openings)}

Return ONLY this JSON — no markdown, no commentary:
{{
  "playing_style": {{
    "classification": "positional",
    "description": "2-sentence description inferred from opening choices and win rates.",
    "evidence": ["opening-based observation 1", "win-rate observation 2"]
  }},
  "tactical_patterns": [
    {{"pattern": "Pattern name", "description": "1-sentence note on what their openings suggest about their play.", "frequency": "common"}}
  ],
  "coaching_recommendations": [
    {{"title": "Short actionable title", "detail": "1-2 sentence recommendation referencing specific openings or win rates.", "priority": "high"}}
  ]
}}

Rules:
- classification: one of aggressive / defensive / positional / tactical
- evidence: exactly 2 items, grounded in the stats above
- tactical_patterns: exactly 2 items, frequency one of common / occasional / rare
- coaching_recommendations: exactly 3 items, priority one of high / medium / low
- Reference specific opening names and win rates — no generic advice"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except Exception:
                continue
    return json.loads(text)


def annotate_move(move: dict, board_context: str) -> str:
    prompt = f"""Chess position context: {board_context}
Move played: {move['san']} ({move['classification']})
Evaluation change: {_eval_change(move):.1f} pawns
Best engine move: {move.get('best_move', 'N/A')}

In 1-2 sentences, explain why this move was {move['classification']} and what should have been played instead (if applicable)."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def _eval_change(move: dict) -> float:
    before = move.get("eval_before") or 0.0
    after = move.get("eval_after") or 0.0
    return after - before
