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
