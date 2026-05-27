# Chesslens — Project Context

_Last updated: 2026-05-27 — Session 17_

> **Full product requirements:** See [`PRD.md`](./PRD.md) — personas, user journey, feature specs, KPIs, backlog.

---

## Product Timeline

| Session | Date | Theme | Key Deliverables |
|---------|------|-------|-----------------|
| 1–2 | 2026-05-10 | Foundation | Project scaffolded. FastAPI backend + React/Vite frontend. Email/password auth with JWT + refresh tokens. Basic game model. |
| 3–4 | 2026-05-12–16 | Import + OAuth wiring | Chess.com game import (monthly archive walk). Google OAuth backend wired. SSH + GitHub push. Lichess parked. |
| 5 | 2026-05-16 | Bug fixes | Game Review screen flickering fixed. Scroll-to-top on move navigation fixed. Monetisation model locked (SaaS subscription). |
| 6 | 2026-05-17 | Google OAuth live | Real Google credentials set. `AuthCallback.tsx` fixed. Delivery checklist added to CLAUDE.md. |
| 7 | 2026-05-17 | Architecture + UX redesign | Two-layer profile pipeline designed (Layer 1: instant metadata, Layer 2: Stockfish background). Full dark navy rebrand (Stripe-inspired). Chess Review page with board, eval bar, move list. Navigation: Dashboard + My Games. |
| 8 | 2026-05-17 | Player Profile — Layer 1 | `PlayerProfile` model. `POST /profile/create`, `POST /profile/rebuild`, `GET /profile/me`. Layer 1: rating history, opening stats, W/D/L, Claude playing style + coaching. Dashboard state machine (empty → build → running → done → failed). |
| 9 | 2026-05-17–18 | Profile UX + stability | Import progress no longer sticks at 0 (incremental DB flush). Dashboard game count fixed (was capped at 200). Claude errors surfaced via `claude_error` field instead of silent null. Rating history dropdowns redesigned. |
| 10 | 2026-05-19 | Layer 2 + Dashboard overhaul | Bulk Stockfish pipeline (depth 1, chain of critical positions). Accuracy over time, phase accuracy, time pressure. Dashboard accuracy sections with chess quotes loading state. `AccuracyChart` with As White / As Black / All Games toggle. Polling fixed (no scroll-to-top every 3s). |
| 11 | 2026-05-20 | My Games overhaul | Full My Games redesign: opponent-only column with avatars, W/D/L badges, accuracy bar, type chips, relative dates. Stats strip with win-rate ring. Filters: result, game type, date range, Chess960. Sort by date / accuracy / result. `chesscom_username` saved on import (opponent column was showing wrong player). |
| 12 | 2026-05-22 | Depth-5 + Game Review UX | Bulk depth 1→5 using running eval chain model (~35s for 1000 games). Eval graph wired into Game Review. Verbal move explanations ("Blunder — dropped 2.3 pawns. Best was Bb6."). Best move in SAN not raw UCI. `eval_before` threaded through MoveEntry. Regression suite: 109/109. |
| 13 | 2026-05-23 | Game Review gate + bug fixes | "Review" in My Games now triggers depth-15 analysis first and shows "Preparing… Xs" — navigates only when analysis is complete. Already-analyzed games open instantly. Dashboard no longer spins forever when profile stuck in stale `pending` after a reset. `/profile/rebuild` endpoint is now force-safe. |
| 14 | 2026-05-23 | Accuracy calibration + analysis speed | All-moves depth-5 bulk (replaces sparse critical-position filter). Accuracy 87.7% → 85.4% — confirmed correct for 1608 ELO. Individual game analysis rewritten: chain model + chess.engine (1 search/move vs 3) + depth 12 → ~1s/game (was 15–40s). All games wiped clean slate. 117/117 regression suite. |
| 15 | 2026-05-23 | Plan check + GitHub push + deployment plan | Confirmed all plan phases (3–4d) already implemented. Pushed Sessions 12–14 work to GitHub (commit a9f2c06). Removed stale root-level regression.md duplicate. Wrote complete production deployment plan (Fly.io + Vercel + Alembic + Postgres). |
| 16 | 2026-05-24 | E2E test + polish + Review gate fixes | README updated with local setup guide. DEPLOYMENT.md added. E2E verified: Google OAuth → import → profile → Game Review. Fixed My Games 200-game cap (→ 5000). Layer 2 progress banner added. X-axis labels removed from charts. "Preparing..." spinner fixed (was disappearing mid-analysis). Poll interval reduced 3s → 1s. PRODUCT_TIMELINE.md created. |
| 17 | 2026-05-27 | Production deployment + polish | Full Fly.io + Vercel deployment. DB reset to Postgres (Alembic migrations). Fixed postgres:// URL scheme, FK-constraint clear-all, cold-start latency. Switched Stockfish to time-based search. Fixed CSS overlap. Fixed eval bar not flipping with board. Accuracy % now colored by outcome (green/white/red). Fixed board auto-orientation race condition. App shared with friends for feedback. |

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
| `services/bulk_analysis.py` — all-moves depth-5 chain model (Layer 2) | ✅ Done |
| `fen_eval_cache` DB table + `FenEvalCache` ORM model | ✅ Done |
| `STOCKFISH_BULK_MOVE_TIME=0.05s` config (time-based, replaces depth-based) | ✅ Done |
| `STOCKFISH_MOVE_TIME=0.1s` individual analysis (time-based, chain model) | ✅ Done |
| `/profile/rebuild` bypasses stuck-pending guard (`force=True`) | ✅ Done |
| `POST /analysis/{game_id}` skips re-analysis if already at depth-12 | ✅ Done |
| `_compute_accuracy`: opening skip (move > 5) + None eval guard | ✅ Done |

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
| Game Review page — Chessboard, EvalBar, MoveList, AnalysisPanel, EvalGraph | ✅ Done |
| Keyboard navigation, best-move arrows, flip board, coordinates | ✅ Done |
| Game Review — eval graph wired in below board | ✅ Done |
| Game Review — verbal move explanations (eval drop in pawns, best move in SAN) | ✅ Done |
| Game Review — `eval_before` passed through MoveEntry for eval drop computation | ✅ Done |
| Game Review — auto-trigger depth-15 analysis removed (now triggered from My Games) | ✅ Done |
| Home page — "Build your Chess Profile" hero | ✅ Done |
| Dashboard — full state machine (empty / build CTA / pipeline running / profile done / failed) | ✅ Done |
| Dashboard — Layer 1 sections (rating chart with dual TC dropdowns, openings, style, coaching) | ✅ Done |
| Dashboard — Layer 2 accuracy sections (chess quotes while loading, fills in when ready) | ✅ Done |
| Dashboard — "Update Profile" button (shows only when new games since last build) | ✅ Done |
| Dashboard — "Updated X ago" subtitle + correct game count from profile.total_games | ✅ Done |
| Dashboard — Analysis-unavailable card (when claude_profile is null, shows error + Rebuild) | ✅ Done |
| Dashboard — polls during Layer 2 run (layer2Running condition) | ✅ Done |
| Dashboard — auto-triggers rebuild when profile is stuck in stale `pending` state | ✅ Done |
| My Games page — game library, stats strip, filters, pagination, per-game Stockfish | ✅ Done |
| My Games — "Review" button triggers depth-15 analysis first, shows "Preparing… Xs" inline | ✅ Done |
| My Games — auto-navigates to Game Review only after analysis completes | ✅ Done |
| Navbar — Dashboard + My Games | ✅ Done |
| `types/index.ts` — PlayerProfile with all fields; MoveEntry with `eval_before` | ✅ Done |
| `profileStore` — `createProfile()` + `rebuildProfile()` actions | ✅ Done |
| Full dark navy rebrand (Stripe-inspired) | ✅ Done |
| Vitest test suite — 17 passing utility tests | ✅ Done |

---

## Session Decisions Log

### Session 17 (2026-05-27) — Production Deployment + Time-based Stockfish

**Changes made:**

1. **Production deployment — Fly.io backend** — Docker image with Stockfish via apt-get. Alembic baseline migration (9 tables). Fly Postgres attached. `postgres://` → `postgresql://` URL fix for SQLAlchemy 2.x. `email-validator==2.2.0` added (Pydantic `EmailStr` dependency). `APP_ENV=production` guards `Base.metadata.create_all` (dev-only). `min_machines_running=1` to eliminate cold starts (~3-5s).

2. **Production deployment — Vercel frontend** — SPA routing via `vercel.json`. Google OAuth authorized origins/redirect URIs updated for production URLs. Deployed at https://frontend-eta-lac-31.vercel.app.

3. **Clear All bug fix (Postgres FK enforcement)** — SQLite silently ignores FK constraints; Postgres enforces them. Bulk `.delete()` bypasses ORM cascades, so child rows must be deleted explicitly. Fixed deletion order: Move → GameAnalysis → BatchAnalysis → Game → PlayerProfile.

4. **Stockfish: depth-based → time-based search** — ⚠️ **Open point for future tuning.** Switched from fixed `depth=12` / `depth=5` to `time=0.1s` / `time=0.05s`. On shared-cpu-1x (Fly.io), this reaches ~depth 8-10. On faster hardware, automatically reaches higher depth. Rationale: adapts to CPU speed without code changes. If accuracy quality is insufficient, upgrade to performance CPU ($6/month extra) or increase time limits.

5. **CSS fix — "Preparing… Xs" overlap** — Actions column in MyGames grid widened from 68px → 100px. Also added `overflow: hidden` to prevent any future overflow into the delete button column.

**Files changed:**
- `backend/app/config.py` — removed STOCKFISH_DEPTH/STOCKFISH_BULK_DEPTH, added STOCKFISH_MOVE_TIME/STOCKFISH_BULK_MOVE_TIME
- `backend/app/services/stockfish.py` — both analyse calls use `Limit(time=...)`
- `backend/app/services/bulk_analysis.py` — `_get_or_cache_eval` uses chess.engine.SimpleEngine; `bulk_analyze_games` replaced `stockfish` library with `chess.engine.SimpleEngine.popen_uci()`
- `backend/app/database.py` — postgres:// → postgresql:// URL fix
- `backend/app/main.py` — guarded Base.metadata.create_all for dev-only
- `backend/app/routers/games.py` — FK-safe clear_all_games
- `backend/requirements.txt` — added email-validator==2.2.0
- `backend/Dockerfile` — apt-get stockfish
- `backend/fly.toml` — min_machines_running=1
- `frontend/src/pages/MyGames.tsx` — COL 68px → 100px, overflow: hidden on Actions div
- `frontend/vercel.json` — SPA rewrites

**Tests:** 117/117 regression suite passing. Both services deployed and live.

**Post-deployment fixes (same session):**

6. **Eval bar flip** — `EvalBar` now accepts a `flipped` prop. When board orientation is Black, white fill anchors to top instead of bottom, keeping the bar in sync with the board. `GameReview.tsx` passes `flipped={orientation === "black"}`.

7. **Accuracy % color by outcome** — `AccuracyCell` now accepts `outcome` prop. Green for wins, white for draws, red for losses. Previously colored by accuracy threshold (≥80% green) which was ambiguous alongside the result badge.

8. **Board auto-orientation race condition** — `useEffect` in `GameReview.tsx` was firing with stale `currentGame` (previous game still in store) before the new game loaded, locking `orientationSetRef` prematurely. Fix: guard `if (currentGame.id !== id) return` so orientation only sets when the loaded game matches the URL param.

**Additional files changed:**
- `frontend/src/components/chess/EvalBar.tsx` — added `flipped` prop
- `frontend/src/pages/GameReview.tsx` — passes `flipped` to EvalBar; URL id guard on orientation effect
- `frontend/src/pages/MyGames.tsx` — `AccuracyCell` colors by outcome

**Open points:**
- Custom domain / nicer subdomain (parked — low priority until wider sharing)
- Stockfish depth tuning: upgrade to performance CPU ($6/month) if accuracy quality insufficient

---

### Session 16 (2026-05-24) — E2E Test + Polish Fixes

**Changes made:**

1. **README + DEPLOYMENT.md** — Updated README with numbered local setup guide (clone → Stockfish → .env → run). Created `DEPLOYMENT.md` with full Fly.io + Vercel + Postgres + Alembic deployment plan.

2. **My Games: 200-game cap lifted** — `gameStore.ts`: `limit=200` → `limit=5000`. Root cause: hardcoded cap meant users with large libraries only saw the 200 most-recent games. Dashboard showed correct total (1776) but My Games was silently truncated.

3. **My Games: Layer 2 progress banner** — Added a pulsing blue banner between the stats strip and filters while bulk accuracy analysis is running. Copy: *"Stockfish is scoring your games — accuracy percentages fill in as Stockfish works through your games. Filters and sorting work on all available data in the meantime."* Auto-disappears when Layer 2 completes.

4. **Dashboard charts: X-axis labels removed** — `tick={false}` on both Rating History and Accuracy Over Time `XAxis` components. Hover tooltips already show date + value — labels were redundant clutter.

**Files changed:**
- `frontend/src/store/gameStore.ts`
- `frontend/src/pages/MyGames.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `README.md`
- `DEPLOYMENT.md` (new)

**Tests:** 17/17 Vitest unit tests passing. E2E flow verified: Google OAuth → import 1776 games → Layer 1 profile → Layer 2 accuracy → My Games (all games) → Game Review.

---

### Session 15 (2026-05-23) — Plan Check + GitHub Push + Deployment Plan

**Changes made:**

1. **Confirmed all plan phases complete** — Phases 3–4d (eval_before, EvalGraph, AnalysisPanel CTA, verbal explanations, Dashboard disclaimer) were all already implemented. Plan was fully done.

2. **GitHub push** — All Sessions 12–14 work pushed (commit `a9f2c06`). Stale root-level `regression.md` duplicate removed (commit `eeb5d32`). Canonical is `backend/regression.md`.

3. **Deployment plan drafted** — Full production deployment plan written:
   - Backend on Fly.io (Docker + Stockfish binary)
   - Frontend on Vercel (SPA routing via vercel.json)
   - Database: Fly.io Postgres (psycopg2-binary already in requirements.txt)
   - Alembic migrations to replace `Base.metadata.create_all()`
   - AI layer (Claude) hidden via empty ANTHROPIC_API_KEY — re-enables with no code changes
   - Three open decisions: domain, machine size, region

**Files changed:**
- `context.md` (this file)
- `PRD.md` (backlog deployment status)

**DB state:** Fresh (wiped in Session 14). Both servers running.

---

### Session 14 (2026-05-23) — Accuracy Calibration + Analysis Speed

**Changes made:**

1. **Bulk analysis: all-moves depth-5 (replaces critical-position filter)**
   - `services/bulk_analysis.py`: removed `_is_critical` filter — every post-opening move is now evaluated via chain model at depth-5
   - `reset_bulk_analysis.py`: updated to also delete stale sparse Move rows before reset (prevents duplicate rows on re-run)
   - All games wiped and re-imported fresh for clean test state
   - Accuracy result: 87.7% → 85.4% — confirmed correct for 1608 ELO (matches depth-12 individual analysis)

2. **Individual game analysis: chain model + chess.engine + depth 12**
   - `services/stockfish.py`: rewritten to use `chess.engine.SimpleEngine` (python-chess) — one search gives both eval AND best move, halving searches vs old `get_evaluation()` + `get_best_move()` separately
   - Chain model applied: `eval_before` = previous move's `eval_after`, eliminates bootstrap searches after the first move
   - Net: ~1 search/move vs old 3 searches/move
   - `.env`: `STOCKFISH_DEPTH=12` (was 15)
   - Result: ~1s/game (was 15–40s)

3. **`_compute_accuracy` fix in `routers/analysis.py`**
   - Added opening skip: `move_number > 5` (first 10 half-moves excluded, consistent with bulk)
   - Fixed None guard: skip moves where `eval_before` or `eval_after` is `None` instead of silently coercing to `0.0`

4. **Regression suite**: 117/117 (added Section 17: all-moves bulk accuracy calibration)

**Files changed:**
- `backend/app/services/bulk_analysis.py`
- `backend/app/services/stockfish.py`
- `backend/app/routers/analysis.py`
- `backend/.env`
- `backend/reset_bulk_analysis.py`
- `backend/regression_test.py`
- `backend/regression.md`

**DB state at end of session:**
- Fresh DB (wiped entirely for clean test slate)
- Both servers running: backend :8000, frontend :5173
- No games imported yet — ready for end-to-end test

---

### Session 13 (2026-05-23) — Bug Fixes + Game Review UX Gate

**Bugs fixed:**

1. **Dashboard infinite spinner after DB reset**: Reset script left `profile.status = 'pending'` but backend's `_upsert_and_trigger` refused new builds when status was `pending`/`running`. Fixed:
   - `routers/profile.py`: `/rebuild` endpoint passes `force=True` to bypass guard
   - `profileStore.ts`: added `rebuildProfile()` calling `POST /profile/rebuild`
   - `Dashboard.tsx`: `useEffect` auto-triggers `rebuildProfile()` once when profile is stuck in `pending` (guarded by `staleRebuildRef`)
   - `reset_bulk_analysis.py`: now also clears `games_done`/`games_total` to avoid stale "183/183" progress bar

2. **Game Review opening before analysis completes**: "Review" button was a `<Link>` that navigated immediately. Fixed with blocking analysis gate:
   - `routers/analysis.py`: `POST /analysis/{game_id}` returns existing analysis immediately if already at depth-15 (any `Move.best_move IS NOT NULL`) — skips wasteful re-run
   - `MyGames.tsx`: Review button calls `handleReview(id)` instead of navigating — triggers analysis, shows "Preparing… Xs" inline spinner with elapsed timer, navigates only when `analysis.status === "done"`
   - Uses `reviewReadyRef` to prevent useEffect firing with stale `done` status from bulk data before refresh

**Files changed:**
- `backend/app/routers/profile.py`
- `backend/app/routers/analysis.py`
- `backend/reset_bulk_analysis.py`
- `frontend/src/store/profileStore.ts`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/MyGames.tsx`

**DB state at end of session:**
- Reset was run: cleared `fen_eval_cache`, reset bulk-only `game_analyses` to pending, reset `player_profiles`
- Profile rebuild triggered (depth-5 bulk analysis), likely completed
- 112/115 games need depth-15 analysis (most old Move rows are from orphaned game IDs)
- 3 games have current depth-15 Move rows

**Open issues from this session:**
- "Preparing..." flow needs end-to-end verification — user couldn't confirm because most games tested were already analyzed. Needs a fresh test on un-analyzed game.

---

### Session 12 (2026-05-22) — Depth-5 Bulk + Game Review UX Sprint

**Built (all from plan `frolicking-zooming-pearl.md`):**

1. **Backend: Depth-5 bulk with chain model** — `STOCKFISH_BULK_DEPTH` 1→5. `_analyze_single_game` uses running eval chain (1 Stockfish call/critical position instead of 2). Bootstrap with 1 eval_before for first critical position. ~35s for 1000 games (was ~70s naive depth-5). FEN eval cache still used.

2. **Backend: Depth-15 individual guard** — `bulk_analyze_games` already skips games with `accuracy_white IS NOT NULL`. No changes needed.

3. **Frontend: MoveEntry extended** — `eval_before: number | null` added to type and passed through `useChessGame.ts`.

4. **Frontend: Game Review UX** —
   - `EvalGraph` wired in below the board (above nav controls)
   - `hasDeepAnalysis` = `currentGame.moves.some(m => m.best_move !== null)` — detects depth-15 vs bulk
   - Auto-trigger depth-15 when game opens without deep analysis (removed later — now gated in My Games)
   - Verbal explanations per move: "Blunder — dropped 2.3 pawns. Best was Bb6."
   - Best move displayed in SAN not raw UCI
   - `eval_before` → eval drop computation (white: before−after, black: after−before)

5. **Frontend: Dashboard** — AccuracyChart subtitle updated to depth-5 language

6. **Backend: reset_bulk_analysis.py** — one-time migration script created

7. **Regression suite** — Section 16 (14 checks): depth-15 analysis completeness. Total: 109/109 passing.

**Architecture decision: Game Review UX gate**
Original plan had auto-trigger + "Run Deep Analysis" CTA. User decided: block navigation from My Games until depth-15 analysis is complete. Already-analyzed games navigate immediately. New games show "Preparing… Xs" and navigate when done.

---

### Session 11 (2026-05-20) — My Games Page Overhaul

**Built:** Full My Games redesign + Chess960 support. (See previous context for details.)

---

### Session 10 (2026-05-19) — Layer 2 Build + Dashboard UI Overhaul

**Built:** Full Layer 2 pipeline end-to-end + full Dashboard UI refresh. (See previous context for details.)

---

### Sessions 1–9

See previous context entries.

---

## Open Issues

| Priority | Issue | Notes |
|----------|-------|-------|
| 🟡 Medium | Anthropic API credits | Playing Style + Coaching sections blank until user tops up at console.anthropic.com |
| 🟢 Low | `bcrypt` pinned to 3.2.2 | Cannot upgrade — passlib 1.7.4 incompatible with bcrypt ≥ 4.0 |

---

## What's Next — Session 17

**Start here:**

1. **Execute deployment plan** — three open decisions to make first: custom domain vs subdomains, machine size (`performance-1x` vs `shared-cpu-1x`), Fly.io region (Singapore recommended). Plan file: `.claude/plans/frolicking-zooming-pearl.md`.

2. **Playing Style & Coaching** — restore once Anthropic credits topped up (console.anthropic.com).

**Backlog (no session assigned yet):**
- Mobile responsiveness
- SaaS deployment (Fly.io + Postgres migration) — **plan drafted, ready to execute**
- User-facing onboarding flow
- React Native mobile app

---

## Analysis Architecture — Two Depths

| Depth | Where used | Trigger | What it stores |
|-------|-----------|---------|----------------|
| `STOCKFISH_BULK_DEPTH=5` | Dashboard accuracy, My Games accuracy | Auto after profile build | `accuracy_white/black`, aggregate blunder/mistake/inaccuracy counts |
| `STOCKFISH_DEPTH=12` | Game Review | Clicking "Review" in My Games (if not already done) | Per-move `eval_before`, `eval_after`, `best_move`, `classification` |

**Key invariant:** Bulk analysis never overwrites a game already at depth-15 (`accuracy_white IS NOT NULL` guard). Depth-15 endpoint skips re-analysis if `Move.best_move IS NOT NULL` already exists.

---

## Critical Implementation Invariants

- UUIDs stored as 32-character hex strings (`uuid.UUID(...).hex`) — never with dashes
- Passwords: SHA-256 pre-hash → bcrypt 3.2.2 — do not change this chain
- bcrypt pinned to 3.2.2 — do not upgrade
- Google OAuth credentials are real, stored in `backend/.env` — never overwrite with placeholders
- SQLite-safe SQL only — no Postgres-specific syntax (future migration target)
- `max_games=0` on Chess.com import means fetch all available games
- `/profile/rebuild` always succeeds (force=True) — safe to call even if stuck in pending/running
- `POST /analysis/{game_id}` is idempotent for depth-15 games — returns existing analysis if already deep

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
