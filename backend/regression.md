# Regression Test Catalogue

Run with: `cd backend && python3 regression_test.py`

All checks must pass (currently 117/117) before any feature is shipped.

> Last updated: Session 14 — chain model + depth-12 individual analysis (~1s/game).

---

## Section 0 — Pre-test cleanup
Purges any leftover test users from previous runs to ensure a clean slate. Verifies the database file exists.

**Pass:** `chesslens.db` found; stale test users deleted without error.

---

## Section 1 — Registration
`POST /auth/register`

**Pass:** Returns 201 with `id` and `email` fields. Duplicate email returns 400.

---

## Section 2 — Login
`POST /auth/login`

**Pass:** Returns 200 with `access_token` and `refresh_token`. Wrong password returns 401.

---

## Section 3 — Token refresh
`POST /auth/refresh`

**Pass:** Returns 200 with a new `access_token`. Invalid refresh token returns 401.

---

## Section 4 — User profile
`GET /users/me`

**Pass:** Returns 200 with correct `email` and `id`. Unauthenticated request returns 401 or 403.

---

## Section 5 — Games — empty state
`GET /games/`

**Pass:** Returns 200 with an empty list for a newly registered user. Unauthenticated returns 401 or 403.

---

## Section 6 — PGN import
`POST /games/import/pgn`

**Pass:** Returns 201 with `id`. Result is `1-0`. Opening is detected. Source is `manual`.

---

## Section 7 — Game retrieval
`GET /games/` and `GET /games/{id}`

**Pass:** Games list has exactly 1 game after PGN import. Game detail returns 200 with `pgn` and `moves` array. Non-existent ID returns 404.

---

## Section 8 — Per-game Stockfish analysis
`POST /analysis/{id}` and `GET /analysis/{id}`

**Pass:** POST returns 202. Status moves off `pending` within the poll window. `accuracy_white`, `accuracy_black`, and `key_moments` are populated. Analysis not stuck at pending.

---

## Section 9 — Portfolio (batch) analysis
`POST /analysis/batch` and `GET /analysis/batch/latest`

**Pass:** POST returns 202. `status` and `total_games` are set. Second POST returns 409. Latest endpoint returns 200 with all expected fields.

---

## Section 10 — Chess.com import job
`POST /games/import/chesscom` and `GET /games/import/jobs/{id}`

**Pass:** POST returns 202 with a job `id`. Status is `pending` or `running`. Job detail endpoint returns 200 with a `status` field.

---

## Section 11 — Game deletion
`DELETE /games/{id}` and `DELETE /games/all`

**Pass:** Per-game delete returns 204 and the game is gone. Re-importing the same PGN returns 201. Clear-all returns 204 and games list is empty.

---

## Section 12 — Player profile API
`POST /profile/create`, `GET /profile/me`, `POST /profile/rebuild`

**Pass:** `/profile/me` returns 404 before creation. Create returns 202. Duplicate create returns 409. Profile reaches `done` or `failed`. `total_games`, `win_pct_white`, `game_count_at_last_build`, `accuracy_history`, `phase_accuracy` (with opening/middlegame/endgame/game_count), and `time_pressure` (with normal_accuracy/pressure_accuracy/games_analyzed) are all present. `games_total` and `games_done` are present. Rebuild returns 202 or 409. Unauthenticated requests return 401 or 403.

---

## Section 13 — Auth hardening
Checks that protected endpoints reject invalid or missing tokens.

**Pass:** Bad JWT on `/users/me`, `GET /games/`, `DELETE /games/all`, `POST /analysis/batch` all return 401 or 403.

---

## Section 14 — API availability
**Pass:** `GET /` and `GET /docs` both respond (not 5xx).

---

## Section 15 — Layer 2 bulk analysis pipeline
Verifies schema columns and cache population after a bulk run.

**Pass:** `fen_eval_cache` table exists. `player_profiles` has columns `games_total`, `games_done`, `game_count_at_last_build`, `progress`, `total_wins`, `total_draws`, `total_losses`. `fen_eval_cache` has rows after a bulk run.

---

---

## Section 16 — Depth-15 individual game analysis
`POST /analysis/{id}` — depth-15 per-game analysis completeness.

**Pass:** Import one game, trigger depth-15 analysis, poll until `status=done`. `accuracy_white` and `accuracy_black` are non-null and in 0–100%. `blunders_white`, `mistakes_white`, `inaccuracies_white` are integers. At least one Move row has `best_move` set (depth-15 signal). Re-running bulk analysis does not overwrite depth-15 accuracy values.

---

## Section 17 — All-moves depth-5 bulk accuracy calibration
Verifies the all-moves chain model writes sufficient Move rows and produces realistic accuracy.

**Pass:** Import one game, build profile to trigger bulk analysis, poll until `accuracy_white` is set. `accuracy_white` and `accuracy_black` are in 40–100% range. Bulk Move rows (where `best_move IS NULL`) count ≥ 20 for a 32-move game — confirming the all-moves approach (not the old sparse critical-position filter which wrote ~10–15).

---

## Planned future sections

| Section | Covers | Trigger |
|---------|--------|---------|
| 18 | Chess960 variant field in game schema — verify `variant` returned by `GET /games/{id}` after importing a Chess960 PGN | When Chess960 end-to-end import is smoke-tested |
