# Chesslens — Regression Test Suite

_Living document. Update this file in parallel with every new module built._

---

## How to Run

With both backend and frontend servers running:

```bash
cd backend
python3 regression_test.py
```

All checks must pass (`PASS X/X`). Any failure blocks the session from being declared complete.

---

## Rule: Tests Are Written in Parallel with Code

When a new module is built (endpoint, service, pipeline, frontend feature):
1. Add a new section to `backend/regression_test.py` covering that module.
2. Document the section here (what it covers, what constitutes passing).
3. Run the full suite and fix any regressions before moving on.

---

## Current Suite — 15 Sections, ~97 Checks

### Section 0 — Pre-test cleanup
Connects to `chesslens.db` and purges any stale test users from previous runs. Blocks the rest of the suite if the DB is missing.

### Section 1 — Registration
- `POST /auth/register` → 201 with user id + email
- Duplicate email → 400

### Section 2 — Login
- `POST /auth/login` → 200 with access_token + refresh_token
- Wrong password → 401

### Section 3 — Token refresh
- `POST /auth/refresh` → 200 with new access_token
- Bad refresh token → 401

### Section 4 — User profile
- `GET /users/me` → 200, email matches, id present
- No auth → 401 or 403

### Section 5 — Games empty state
- `GET /games/` → 200, returns `[]`
- No auth → 401 or 403

### Section 6 — PGN import
- `POST /games/import/pgn` → 201
- Returns game id, result `1-0`, opening `Italian Game`, source `manual`

### Section 7 — Game retrieval
- `GET /games/` → list has 1 game
- `GET /games/{id}` → 200 with pgn + moves array
- Non-existent id → 404

### Section 8 — Per-game Stockfish analysis
- `POST /analysis/{id}` → 202, status pending or done
- Polls up to 30s until done
- `GET /analysis/{id}` → accuracy_white, accuracy_black, key_moments all set when status=done

### Section 9 — Portfolio (batch) analysis
- `POST /analysis/batch` → 202
- Second call while running → 409
- `GET /analysis/batch/latest` → has id, status, total_games, games_analyzed

### Section 10 — Chess.com import job
- `POST /games/import/chesscom` → 202 (uses `hikaru`, max_games=1, rapid)
- Import job has id, status in expected set
- `GET /games/import/jobs/{id}` → 200 with status

### Section 11 — Game deletion
- `DELETE /games/{id}` → 204, game gone from list
- Re-upload + `DELETE /games/all` → 204, list empty

### Section 12 — Player profile API (Layer 1 + Layer 2)
- `GET /profile/me` before create → 404
- `POST /profile/create` → 202, status pending/running/done
- Duplicate create while running → 409
- Polls up to 15s until Layer 1 done (status=done)
- When done: `total_games` int > 0, `win_pct_white` nullable OK, `game_count_at_last_build` set
- Layer 2 fields (`accuracy_history`, `phase_accuracy`, `time_pressure`): accepts list/dict or null
- Secondary poll (up to 60s): waits for `accuracy_history` to be populated by Layer 2
- When `accuracy_history` is present: validates new format — entries must have `accuracy` (float) and `color` ("white" or "black") keys, not old `accuracy_white`/`accuracy_black` keys
- `phase_accuracy` structure: `opening`, `middlegame`, `endgame`, `game_count` keys present
- `time_pressure` structure: `normal_accuracy`, `pressure_accuracy`, `games_analyzed` keys present
- `games_total` and `games_done` fields present in response
- `POST /profile/rebuild` → 202 or 409
- No auth → 401 or 403

### Section 13 — Auth hardening
- Bad JWT on `/users/me`, `GET /games/`, `DELETE /games/all`, `POST /analysis/batch` → 401 or 403

### Section 14 — API availability
- `GET /` responds (not 5xx)
- `GET /docs` → 200

### Section 15 — Layer 2 bulk analysis pipeline (DB schema)

DB-only checks run after Section 12 (profile and games already cleaned up):
- `fen_eval_cache` table exists in DB
- `player_profiles` columns: `games_total`, `games_done`, `game_count_at_last_build`, `progress`, `total_wins`, `total_draws`, `total_losses` all present
- `fen_eval_cache` has rows (populated during Section 12 profile build — cache survives cleanup)

---

## Known Acceptable States

| Condition | Acceptable |
|-----------|-----------|
| `win_pct_white` or `win_pct_black` is null | Yes — null when no games played as that color |
| `claude_profile` is null | Yes — Claude API credits may be depleted; `claude_error` should be set |
| `accuracy_history` is null after Layer 1 | Yes — Layer 2 hasn't run yet |
| `phase_accuracy` / `time_pressure` is null | Yes — Layer 2 hasn't run, or no clock data in PGN |
| Accuracy values 85–95% (higher than chess.com) | Yes — known limitation of depth-1 + critical-positions-only. Trend is meaningful; absolute values are not. Open issue: increase `STOCKFISH_BULK_DEPTH`. |
| Chess.com import job stuck at `running` | No — indicates backend crash during import |
| Profile status stuck at `pending` or `running` | No — indicates background task never started or crashed silently |
