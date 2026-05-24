# Chesslens — Product Timeline

> Built from scratch to a feature-complete MVP in 16 sessions across two weeks (May 10–24, 2026).

---

## At a Glance

| Milestone | Date | What It Unlocked |
|-----------|------|-----------------|
| First working app | May 10 | Auth + game model running locally |
| Chess.com import | May 12 | Games importable from any Chess.com account |
| Google OAuth | May 17 | One-click sign-in, no password required |
| Dark navy redesign | May 17 | Stripe-inspired UI; two-layer analysis architecture decided |
| Player Profile (Layer 1) | May 17 | Instant profile — opening repertoire, style, coaching — no Stockfish |
| Layer 2 accuracy | May 19 | Background Stockfish pipeline; accuracy charts appear automatically |
| My Games page | May 20 | Full game library with filters, stats strip, per-game analysis |
| Game Review gate | May 23 | "Preparing..." blocks navigation until depth-12 analysis completes |
| Analysis speed | May 23 | 15–40s per game → ~1s per game |
| MVP ready | May 24 | E2E tested end-to-end; 117/117 regression checks; deployment plan drafted |

---

## Session Log

### Sessions 1–2 · May 10 · Foundation

Project created from scratch. FastAPI backend and React/Vite frontend scaffolded. Email/password auth implemented with JWT access tokens and refresh tokens. Basic `Game` database model created. Served locally on ports 8000 (backend) and 5173 (frontend).

---

### Sessions 3–4 · May 12–16 · Import & OAuth

Chess.com game import wired up — walks monthly archives newest-first until the requested limit is reached. Google OAuth backend integrated. SSH key and GitHub repository set up. Lichess import explored but parked (code exists, not exposed in UI).

---

### Session 5 · May 16 · Bug Fixes

Game Review screen flickering fixed. Scroll-to-top on move navigation fixed. Monetisation model locked: SaaS subscription (not open source, not one-time purchase).

---

### Session 6 · May 17 · Google OAuth Live

Real Google credentials set and tested. `AuthCallback.tsx` fixed to correctly read tokens from URL parameters. Delivery checklist added to `CLAUDE.md` — enforced at the end of every session from this point forward.

---

### Session 7 · May 17 · Architecture & Redesign

**Biggest architectural decision of the project:** Two-layer profile pipeline designed.

- **Layer 1:** Instant — pure PGN metadata, no Stockfish. Profile appears in seconds regardless of game count.
- **Layer 2:** Background — Stockfish runs automatically after Layer 1, user can leave the page.

Full dark navy UI redesign (Stripe-inspired). Chess Review page rebuilt with board, eval bar, and move list. Navigation simplified to Dashboard + My Games.

---

### Session 8 · May 17 · Player Profile — Layer 1

`PlayerProfile` database model created. Three profile endpoints built: `POST /profile/create`, `POST /profile/rebuild`, `GET /profile/me`. Layer 1 computes: rating history, opening stats (As White / As Black), W/D/L, win percentage, and calls Claude for playing style and coaching recommendations.

Dashboard state machine implemented: empty → build CTA → pipeline running → profile done → failed. Each state has a distinct UI.

---

### Session 9 · May 17–18 · Profile Stability

Import progress no longer stuck at 0% — games flushed to DB every 50 imports instead of all-at-end. Dashboard game count fixed (was capped at 200 — now pulls from `profile.total_games`). Claude errors surfaced via a `claude_error` field instead of silently returning null. Rating history dropdowns redesigned.

---

### Session 10 · May 19 · Layer 2 + Dashboard Overhaul

Full Layer 2 pipeline built end-to-end: bulk Stockfish evaluation, accuracy over time, phase accuracy (Opening / Middlegame / Endgame), and time pressure performance (normal vs under-pressure). Dashboard accuracy sections added with rotating chess quotes as a loading state while Stockfish runs. `AccuracyChart` built with As White / As Black / All Games toggle. Dashboard polling fixed — no more scroll-to-top every 3 seconds.

---

### Session 11 · May 20 · My Games Page

Full My Games page built:

- Opponent-only column with piece colour indicator (not the user's own name)
- W / D / L result badges
- Accuracy bar per game
- Game type chips (Bullet / Blitz / Rapid / Classical / Chess960)
- Stats strip: win-rate ring, W/D/L stacked bar
- Filters: result, game type, date range, Chess960
- Sort by date, accuracy, or result
- `chesscom_username` saved on import to prevent opponent column showing the wrong player

---

### Session 12 · May 22 · Analysis Engine v1 + Game Review UX

Bulk Stockfish upgraded from depth-1 to depth-5 using a running eval chain model (1 search per position instead of 2). ~35s for 1,000 games.

Game Review fully wired:
- Eval graph clickable below the board
- Verbal move explanations: *"Blunder — dropped 2.3 pawns. Best was Bb6."*
- Best move displayed in SAN notation (not raw UCI engine output)
- `eval_before` threaded through each move for accurate eval-drop computation

Regression suite: 109/109 checks.

---

### Session 13 · May 23 · Game Review Gate

**"Preparing..." gate built:** clicking Review in My Games now triggers depth-12 Stockfish analysis first. A live elapsed-time counter shows while analysis runs. Navigation to Game Review fires only when analysis is complete. Already-analyzed games open instantly — no wait.

Two bugs also fixed:
- Dashboard infinite spinner after a DB reset — profile stuck in `pending` state, now auto-triggers rebuild once.
- `/profile/rebuild` endpoint made force-safe — always succeeds even if a stale run is in progress.

---

### Session 14 · May 23 · Accuracy Calibration + Speed

**All-moves bulk analysis:** sparse critical-position filter replaced with evaluation of every post-opening move at depth-5. Accuracy result: 87.7% → 85.4% — confirmed correct for a 1608 ELO player, consistent with chess.com's own accuracy metric.

**Individual game analysis rewritten:** `chess.engine.SimpleEngine` (python-chess) chain model applied. One search per move gives both eval and best move simultaneously. Chain model: `eval_before` = previous move's `eval_after` — eliminates redundant searches after the first move.

Result: ~1s per game (was 15–40s). Regression suite expanded to 117/117 checks.

---

### Session 15 · May 23 · GitHub Push + Deployment Plan

All Sessions 12–14 work pushed to GitHub. Stale duplicate `regression.md` at the root removed — canonical file is `backend/regression.md`.

Full production deployment plan written: backend on Fly.io (Docker + Stockfish binary), frontend on Vercel (SPA routing), database on Fly.io Postgres, Alembic migrations to replace `Base.metadata.create_all()`. Claude AI layer hidden for MVP via an empty env var — re-enables with no code changes.

---

### Session 16 · May 24 · MVP Polish + E2E Test

README updated with step-by-step local setup guide. `DEPLOYMENT.md` added. End-to-end flow verified manually: Google OAuth → Chess.com import (1,776 games) → Layer 1 profile → Layer 2 accuracy → My Games (all 1,776 games) → Game Review with full move analysis.

**Bugs found and fixed:**
- My Games silently capped at 200 games — lifted to 5,000
- Layer 2 progress banner added to My Games (shows while Stockfish is running)
- X-axis date labels removed from Rating History and Accuracy Over Time charts (tooltips already show the value)
- "Preparing..." spinner disappeared mid-analysis — fixed
- Up to 3s extra wait after analysis completed — poll interval reduced to 1s

---

## Key Architectural Decisions

| Decision | What Was Chosen | Why |
|----------|----------------|-----|
| **Two-layer pipeline** | Layer 1 instant (no Stockfish) + Layer 2 background (Stockfish) | Profile appears in seconds for any game count; accuracy fills in automatically |
| **API-first** | All logic in FastAPI; React is a thin client | Same backend works for a future React Native mobile app with no changes |
| **Chain eval model** | `eval_before` = previous move's `eval_after` | Halves Stockfish searches; 1 search/move instead of 2 |
| **All-moves depth-5 bulk** | Every post-opening move evaluated (not just critical positions) | More accurate; consistent with chess.com/Lichess accuracy formula |
| **Depth-12 individual** | Separate deeper analysis triggered from My Games | Balance: fast bulk profile (~1s/game cap) + detailed per-game review |
| **Depth-12 guard** | Bulk never overwrites a game already analyzed at depth-12 | Prevents degrading data quality when profile is rebuilt |
| **Auth security** | SHA-256 pre-hash → bcrypt 3.2.2 | Bypasses bcrypt 72-byte truncation; bcrypt pinned to avoid passlib incompatibility |
| **UUID as hex strings** | `String(32)` in SQLite, not PostgreSQL UUID type | Schema is Postgres-compatible without requiring Postgres-specific types |
| **Game Review gate** | Block navigation until depth-12 is done | Cleaner UX than navigating to a partially analyzed game |
| **Claude AI = optional** | Empty `ANTHROPIC_API_KEY` hides AI sections gracefully | MVP ships with all Stockfish features; AI layer re-enables with one env var |

---

## MVP State (May 24, 2026)

| Feature | Status |
|---------|--------|
| Chess.com import (all filters, incremental) | ✅ Complete |
| Layer 1 — instant profile (rating, openings, W/D/L, style, coaching) | ✅ Complete |
| Layer 2 — background accuracy (over time, by phase, by time pressure) | ✅ Complete |
| My Games — full library, filters, sorting, stats | ✅ Complete |
| Game Review — board replay, eval bar, eval graph, move classification, verbal explanations | ✅ Complete |
| Auth — email/password + Google OAuth | ✅ Complete |
| Regression suite | ✅ 117/117 |
| Production deployment plan | ✅ Drafted (see DEPLOYMENT.md) |
| Deployed to production | Pending |
| AI layer (Playing Style, Coaching, per-game summary) | Pending API credits |
| Mobile responsiveness | Pending |
| React Native app | Future |
