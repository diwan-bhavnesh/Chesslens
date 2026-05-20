# Chesslens — Project Context

_Last updated: 2026-05-20 — Session 11_

> **Full product requirements:** See [`PRD.md`](./PRD.md) — personas, user journey, feature specs, KPIs, backlog.

---

## What's Built

### Backend (FastAPI + SQLite)

| Area | Status |
|------|--------|
| Auth — email/password (JWT + refresh token) | ✅ Done |
| Auth — Google OAuth (sign in + sign up) | ✅ Done |
| User model + `/users/me` endpoint | ✅ Done |
| Game import — Chess.com (monthly archive walk) | ✅ Done |
| Game model + Move model (UUID hex PKs) | ✅ Done |
| Tier 2 analysis — Stockfish per-game (`POST /analysis/{game_id}`) | ✅ Done |
| Move classification (brilliant/best/good/inaccuracy/mistake/blunder) | ✅ Done |
| Accuracy % calculation (Stockfish win-probability formula) | ✅ Done |
| Key moments extraction (eval drop ≥ 1.5 pawns) | ✅ Done |
| Claude narrative summary per game | ✅ Done |
| Delete game / clear all games | ✅ Done |
| Password: SHA-256 pre-hash → bcrypt (72-byte bypass) | ✅ Done |
| `played_at` set from PGN Date header on import | ✅ Done |
| `PlayerProfile` model + table (`player_profiles`) | ✅ Done |
| `GET /profile/me`, `POST /profile/create`, `POST /profile/rebuild` | ✅ Done |
| `services/profile.py` — Layer 1 computation + Claude synthesis | ✅ Done |
| `PlayerProfile` fields: `progress`, `games_done`, `games_total`, `game_count_at_last_build`, `win_pct_white`, `win_pct_black`, `total_games`, `claude_error` | ✅ Done |
| Import progress — incremental flush every 50 games | ✅ Done |
| `services/bulk_analysis.py` — selective Stockfish pipeline (Layer 2) | ✅ Done |
| `fen_eval_cache` DB table + `FenEvalCache` ORM model | ✅ Done |
| `STOCKFISH_BULK_DEPTH=1` config | ✅ Done |

### Frontend (React + Vite + TypeScript)

| Area | Status |
|------|--------|
| Auth pages — Login, Register | ✅ Done |
| Google OAuth (sign in + sign up) | ✅ Done |
| `AuthCallback.tsx` — reads tokens from URL params, saves, navigates | ✅ Done |
| Zustand stores — `authStore`, `gameStore`, `filterStore`, `profileStore` | ✅ Done |
| Token refresh interceptor (Axios) | ✅ Done |
| Import Games page — date range, game type, time control filters | ✅ Done |
| Import Games — auto-triggers `POST /profile/create` after success | ✅ Done |
| Game Review page — Chessboard, EvalBar, MoveList, AnalysisPanel | ✅ Done |
| Keyboard navigation, best-move arrows, flip board, coordinates | ✅ Done |
| Home page — "Build your Chess Profile" hero | ✅ Done |
| Dashboard — full state machine (empty / build CTA / pipeline running / profile done / failed) | ✅ Done |
| Dashboard — Layer 1 sections (rating chart with dual TC dropdowns, openings, style, coaching) | ✅ Done |
| Dashboard — Layer 2 accuracy sections (chess quotes while loading, fills in when ready) | ✅ Done |
| Dashboard — "Update Profile" button (shows only when new games since last build) | ✅ Done |
| Dashboard — "Updated X ago" subtitle + correct game count from profile.total_games | ✅ Done |
| Dashboard — Analysis-unavailable card (when claude_profile is null, shows error + Rebuild) | ✅ Done |
| Dashboard — polls during Layer 2 run (layer2Running condition) | ✅ Done |
| My Games page — game library, stats strip, filters, pagination, per-game Stockfish, Review | ✅ Done |
| Navbar — Dashboard + My Games | ✅ Done |
| `types/index.ts` — PlayerProfile with all fields including `total_games`, `claude_error` | ✅ Done |
| `profileStore` — `createProfile()` action | ✅ Done |
| Full dark navy rebrand (Stripe-inspired) | ✅ Done |
| Vitest test suite — 17 passing utility tests | ✅ Done |

---

## Session Decisions Log

### Session 10 (2026-05-19) — Layer 2 Build + Dashboard UI Overhaul

**Built:** Full Layer 2 pipeline end-to-end + full Dashboard UI refresh.

**Layer 2 backend:**
- `services/bulk_analysis.py` — opening filter (skip first 10 half-moves) → critical position filter (captures, checks, moves to attacked squares) → FEN cache lookup → Stockfish depth 1 NNUE → sparse Move rows written → GameAnalysis upserted per game
- `fen_eval_cache` DB table + `FenEvalCache` ORM model — shared FEN eval cache across all users
- `STOCKFISH_BULK_DEPTH=1` in config.py and .env
- `PlayerProfile` model + DB: added `games_total`, `games_done`, `progress`, `game_count_at_last_build`, `total_wins`, `total_draws`, `total_losses` columns
- `services/profile.py` — `compute_accuracy_history` now filters to user's own color per game (was incorrectly including opponent's accuracy); returns `{date, accuracy, color}` format
- `routers/profile.py` — `PlayerProfileOut` schema updated with all new fields
- Regression suite: 92/92 passing.

**Dashboard UI:**
- Two-column layout: Opening Repertoire left | Phase Accuracy + Time Pressure right (falls back to full-width if Layer 2 not done)
- Stats strip redesigned: flex layout with W/D/L stacked bar (proportional green/grey/red + colour-coded counts)
- Rating History dropdowns: counts removed from labels
- `RatingChart` wrapped in `React.memo` with length-based comparator (reference equality always fails on JSON deserialisation)
- Polling fix: `pollProfile()` added to profileStore — silent fetch (no `isLoading: true`). Poll interval uses `pollProfile` instead of `fetchProfile` to eliminate scroll-to-top and full re-render every 3 seconds
- `AccuracyChart` rewritten: As White / As Black / All Games toggle; 15-game rolling average; Y-axis auto-scales; disclaimer subtitle on SectionCard
- `AccuracyHistoryPoint` type updated: `{date, accuracy, color}` (was `{date, accuracy_white, accuracy_black}`)
- Stale format guard: if existing profile has old accuracy format, "Update Profile" button appears automatically

**Files changed:** `config.py`, `.env`, `models/game.py`, `services/bulk_analysis.py` (new), `services/profile.py`, `routers/profile.py`, `Dashboard.tsx`, `profileStore.ts`, `types/index.ts`, `regression_test.py`

---

### Session 9 (2026-05-17–18) — Profile UX Fixes + Layer 2 Planning

**Problems solved:**
- Import progress stuck at 0 during long imports — fixed with incremental DB flush every 50 games
- Dashboard showed wrong game count (capped at 200 due to frontend limit) — fixed with `total_games` column on profile
- Claude synthesis silently failing — `synthesize_player_profile()` prompt rewritten to use Layer 1 data only (no accuracy/Stockfish references); errors surfaced via `claude_error` field
- Rating history filter too coarse — replaced single pill row with two cascading dropdowns (Game Type → Time Control) using human-readable TC notation

**Decisions:**
- Layer 2 pipeline design confirmed: pure-Python opening depth cutoff (skip first 10 half-moves) instead of Polyglot — no file dependency
- `regression.md` created as living test catalogue; CLAUDE.md updated to require test additions in parallel with each module
- `claude_error` field added to profile — surfaces Claude API failures visibly instead of silent null

**Files changed:** `Dashboard.tsx` (RatingChart, analysis-unavailable card, game count), `types/index.ts`, `models/game.py`, `services/profile.py`, `services/claude.py`, `routers/profile.py`, `regression_test.py` (Section 12), `regression.md` (new), `CLAUDE.md`

---

### Session 8 (2026-05-17) — Player Profile Engine — Layer 1

**Built:** Full Layer 1 pipeline end-to-end. `POST /profile/create`, `POST /profile/rebuild`, `GET /profile/me`. Layer 1 computes rating history, opening stats, win %, and calls Claude for style + coaching. Dashboard polling wired. Profile state machine complete.

**Regression suite:** Extended to 75 checks across 14 sections. Section 12 (Player Profile) added.

---

### Session 7 (2026-05-17) — UX Redesign + Frontend Prototype Built

**Architecture decisions locked:**

1. **Two-layer profile pipeline:**
   - Layer 1 (instant, seconds): PGN metadata → rating history, opening stats, W/D/L, White/Black win %, Claude playing style + coaching. No Stockfish.
   - Layer 2 (background, <60s for 10,000 games): Selective Stockfish depth 1 NNUE → accuracy over time, phase accuracy, time pressure, blunder patterns.

2. **Scalable analysis engine (Layer 2):**
   - Step 1: Opening depth cutoff — skip first 10 half-moves (no Polyglot file)
   - Step 2: Critical position detection (pure Python) — keep captures, checks, moves to attacked squares by non-pawn pieces
   - Step 3: FEN deduplication + global eval cache (`fen_eval_cache` table, shared across ALL users)
   - Step 4: Stockfish depth 1 NNUE, single engine reused across games — ~15–30s cold, ~1–3s warm

3. **Performance targets (hard constraints):**
   - MVP: < 60s for 10,000 games
   - Post-MVP: < 30s (replace Stockfish with batch neural net, e.g. Maia-style)

4. **Two Stockfish depths:**
   - `STOCKFISH_BULK_DEPTH=1` — bulk profile (NNUE only, no tree search)
   - `STOCKFISH_DEPTH=15` — individual game review (unchanged)

5. **Navigation:** Dashboard + My Games. Import hidden from nav. My Games hosts game library + per-game Stockfish. Dashboard hosts the profile only.

6. **"Update Profile" button rule:** Appears ONLY when `games.length > profile.game_count_at_last_build`.

7. **Chess quotes loading state:** While Layer 2 computes, accuracy sections display rotating chess quotes (12 quotes, cycle every 8s).

---

### Session 6 (2026-05-17) — Google OAuth Fixed

- Google OAuth credentials set (real credentials in `backend/.env`)
- `AuthCallback.tsx` TypeScript error fixed
- Delivery checklist added to CLAUDE.md

---

### Session 5 (2026-05-16) — Bug Fixes

- BUG-A (Game Review screen flickering) — fixed
- BUG-B (Game Review scroll-to-top) — fixed
- Monetisation locked: SaaS subscription model

---

### Sessions 3–4 (2026-05-12–16)

- Lichess removed from MVP (parked, code remains)
- Google OAuth backend wired
- SSH key set up, project pushed to GitHub

---

## Open Issues

| Priority | Issue | Notes |
|----------|-------|-------|
| 🟡 Medium | Anthropic API credits depleted | User must top up at console.anthropic.com |
| 🟡 Medium | My Games accuracy shows depth-1 values (`~`) | `STOCKFISH_BULK_DEPTH=1` inflates accuracy to 85–95% range (realistic is 65–85%). Plan decided (Session 11): increase to depth 5 using the running eval chain model. See plan file `splendid-twirling-walrus.md`. Deferred to a separate session. Game Review page is unaffected — uses `STOCKFISH_DEPTH=15`. |
| 🟢 Low | `bcrypt` pinned to 3.2.2 | Cannot upgrade — passlib 1.7.4 incompatible with bcrypt ≥ 4.0 |

---

## What's Next — Session 12

**Start here:**

1. **Game Review page UI review** — audit the board, eval bar, move list, and analysis panel for UX/design issues. Same feedback-first approach as Session 11 My Games review.
2. **Increase `STOCKFISH_BULK_DEPTH` to 5** — plan is fully designed (`splendid-twirling-walrus.md`). Files: `config.py`, `.env`, `bulk_analysis.py` (`_analyze_single_game`), `Dashboard.tsx` (remove depth-1 disclaimer). Removes `~` tilde from My Games accuracy.
3. **Playing Style & Coaching** — restore clean display once Anthropic credits are topped up (console.anthropic.com).

**Backlog (no session assigned yet):**
- Mobile responsiveness
- SaaS deployment (Fly.io + Postgres migration)
- User-facing onboarding flow
- React Native mobile app

## Session 11 (2026-05-20) — My Games Page Overhaul

**Built:** Full My Games redesign + Chess960 support.

**Backend:**
- `game.py`: added `variant = Column(String, nullable=True)` column for Chess960 detection
- `chesscom.py`: `normalize_chesscom_game()` now captures `"variant": raw.get("rules", "chess")`
- `schemas/game.py`: `GameOut` exposes `variant: Optional[str] = None`
- `routers/games.py`: import route now saves `chesscom_username` to the user record on every Chess.com import
- SQLite migration: `ALTER TABLE games ADD COLUMN variant VARCHAR`
- DB backfill: `chesscom_username = 'bhavnesh123'` set for existing account

**Frontend:**
- `types/index.ts`: `Game` interface gains `variant: string | null`
- `filterStore.ts`: removed `platform` state; result values changed to `"win"/"loss"/"draw"`; added `sortBy` / `sortDir`
- `MyGames.tsx`: full rewrite —
  - Stats strip: Total | W/D/L stacked bar | SVG win-rate ring (all user-relative)
  - Filters: two rows, contextual active colours, Chess960 added to Type
  - Game rows: opponent-only column with initials avatar + color pip (white/blue square), Win/Loss/Draw badges, left accent bar, accuracy bar with `~`, type badge dot-colors, relative dates, inline delete confirmation
  - Sort toolbar: Date / Accuracy / Result with asc/desc toggle
  - All W/D/L and accuracy computed from user's perspective via `chesscom_username`

**Bugs fixed this session:**
- `chesscom_username` never saved on import → opponent column showed user's own name
- Unicode ♔/♚ pip rendered as bullet dot → replaced with styled colored square
- Result filter used raw chess notation ("1-0") → now uses user-relative "win"/"loss"/"draw"

**Parked:**
- My Games accuracy depth (depth-1 `~` values) — acceptable for now, depth-5 plan in open issues

---

## Layer 2 Build Plan (Reference)

### Goal
Bulk accuracy analysis that runs automatically after Layer 1. No user action required. Produces: Accuracy over time, Phase accuracy (Opening / Middlegame / Endgame), Time pressure (normal vs under pressure).

### Pipeline (inside `services/bulk_analysis.py`)

For each unanalyzed game:
1. **Opening filter** — skip first 10 half-moves (pure Python, zero file dependency)
2. **Critical position filter** — from remaining moves, keep: captures, checks, moves to attacked squares by non-pawn pieces. ~60% reduction.
3. **FEN cache lookup** — MD5-hash each critical FEN, check `fen_eval_cache`. If found, use cached eval, zero Stockfish call.
4. **Stockfish depth 1 NNUE** — only for uncached FENs. ~2–5ms per position.
5. **Store Move rows** (critical positions only) + upsert `GameAnalysis` with per-game accuracy.

After all games: call `compute_accuracy_history()`, `compute_phase_accuracy()`, `compute_time_pressure()` → save to profile.

### Files to create / change

| File | Change |
|------|--------|
| DB migration | `CREATE TABLE fen_eval_cache (fen_hash TEXT PK, eval_cp INT, depth INT, created_at TIMESTAMP)` |
| `backend/app/models/game.py` | Add `FenEvalCache` ORM model |
| `backend/app/config.py` | Add `STOCKFISH_BULK_DEPTH: int = 1` |
| `backend/.env` | Add `STOCKFISH_BULK_DEPTH=1` |
| `backend/app/services/bulk_analysis.py` | New file — full pipeline (see below) |
| `backend/app/services/profile.py` | After Layer 1 save, call `bulk_analyze_games()` then accuracy compute functions |
| `frontend/src/pages/Dashboard.tsx` | Extend polling: `const shouldPoll = isPipelineActive \|\| layer2Running` |

### Key functions in `bulk_analysis.py`

- `_is_critical(board, move) -> bool` — captures + checks + sacrifice-candidate squares
- `_get_or_cache_eval(fen, engine, db) -> float | None` — cache lookup then Stockfish
- `_accuracy_from_move_dicts(moves, color) -> float | None` — win-prob formula on dicts
- `bulk_analyze_games(user_id, db, profile)` — orchestrator: finds unanalyzed games, creates one Stockfish engine, loops, flushes every 10 games, skips errors silently

### Regression tests to add (Section 15)

- Profile eventually has `accuracy_history` as non-empty list
- `phase_accuracy` not null, has opening/middlegame/endgame keys
- `time_pressure` not null, has normal_accuracy/pressure_accuracy keys
- `games_total` set during run (progress tracking)
- `fen_eval_cache` table exists with rows after run
- Games already at depth 15 not overwritten by bulk pipeline

### Performance target

< 60s for 10,000 games cold. Scales with FEN cache warmth.

---

## Analysis Architecture — Token Rules

**Rule: Token usage must stay flat regardless of game count (even 100k games).**

- All data extraction is programmatic (Python, zero Claude calls per game)
- Claude receives one compact structured summary per user per rebuild (~3KB)
- No raw move text, no FEN strings, no per-game API calls to Claude

Current Claude calls:
- `generate_game_summary()` — per-game summary (Haiku, ~800 tokens — unchanged)
- `synthesize_player_profile()` — Layer 1 data → narrative (Sonnet, ~1500 tokens)

---

## Design System — Current State

Hard rules (do not break):

- **Gold (`#D4A843`):** logo + primary CTA buttons only
- **Eval graph line:** `#2563EB` (blue) — not gold
- **Accuracy % and best move:** `#F5F0E8` (warm white) — not gold
- **Card bg:** `--navy-card: #132840` with `box-shadow: 0 1px 3px rgba(0,0,0,0.4)`
- **Dashboard:** `maxWidth: 960`, `padding: 1.5rem 2rem`
- **My Games:** `maxWidth: 1280`, `padding: 1.5rem 2rem`

---

## Critical Implementation Invariants

- UUIDs stored as 32-character hex strings (`uuid.UUID(...).hex`) — never with dashes
- Passwords: SHA-256 pre-hash → bcrypt 3.2.2 — do not change this chain
- bcrypt pinned to 3.2.2 — do not upgrade
- Google OAuth credentials are real, stored in `backend/.env` — never overwrite with placeholders
- SQLite-safe SQL only — no Postgres-specific syntax (future migration target)
- `max_games=0` on Chess.com import means fetch all available games

---

## Parked — Visual Upgrades

| Item | Notes |
|------|-------|
| Mobile responsiveness | No responsive breakpoints yet |
| Hover / micro-animations | Cards, buttons, nav |
| SaaS deployment | Not started (Fly.io + Postgres migration) |
| User-facing onboarding flow | First-time experience not guided |
| Notifications when analysis completes | No email or in-app notification |
| Rate limiting on import endpoints | No abuse protection |
| Opening explorer | Not in scope yet |
| Game comparison / social sharing | Not in scope yet |
