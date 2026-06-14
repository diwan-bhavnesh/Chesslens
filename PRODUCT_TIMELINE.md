# Chesslens — Product Timeline

> Built from scratch to a production-deployed MVP in 17 sessions (May 10 – May 27, 2026). Now evolving toward an LLM-powered chess recommendation engine.

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
| Production live | May 27 | Fly.io + Vercel deployed; Postgres migration; real users onboarded |
| Reliability fix | Jun 14 | Stuck analysis auto-reset shipped; 121/121 regression checks |
| LLM direction decided | Jun 14 | Lichess Cloud Eval cancelled (15.5% coverage); LLM recommendation engine adopted as the product direction |

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

### Session 17 · May 27 · Production Deployment

Full production deployment:
- **Backend:** Fly.io with Docker + Stockfish via apt-get. Alembic baseline migration (9 tables). Fly Postgres attached.
- **Frontend:** Vercel with SPA routing. Google OAuth updated for production URLs.
- **Stockfish:** switched from fixed depth to time-based search (`0.1s` individual, `0.05s` bulk) — adapts to CPU speed automatically.

Bugs fixed post-deploy: eval bar not flipping with board orientation, accuracy % now colored by outcome (green/white/red), board orientation race condition resolved.

---

### Sessions 18–19 · May 31 – Jun 11 · Lichess Cloud Eval Exploration

Explored using Lichess's free pre-computed Stockfish database to speed up bulk analysis. Full "Harvest Before You Need It" architecture designed: silent harvest after import warms the `fen_eval_cache`, Layer 2 becomes pure DB reads in seconds.

No code written — coverage measurement run first per plan.

---

### Session 20 · Jun 14 · Stuck Analysis Fix

Bulk accuracy analysis stuck on production for a 205-game import after a Fly.io machine restart killed the background task mid-run.

Two-part fix:
1. Heartbeat: stamp `profile.updated_at` every 10 games in Layer 2
2. Staleness check on `GET /profile/me` resets both stuck-running AND stuck-done states after 5 minutes of no heartbeat

Deployed to production. 121/121 regression suite.

---

### Session 21 · Jun 14 · Lichess Coverage Gate + LLM Direction Pivot

Coverage gate run against 532 local games: Lichess Cloud Eval hit rate was 52% for moves 6–10, 10% for moves 11–15, 0% beyond. Overall 15.5% — too low for the harvest architecture to deliver its promised speedup.

**Lichess integration cancelled.**

New product direction decided: **LLM-powered chess recommendation engine.** Instead of centipawn accuracy, analyze patterns across games and generate coach-style insights. Learning path: local Ollama first → production API (Claude Haiku or Gemini Flash).

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
| LLM recommendation engine | In progress — see learning path below |
| Mobile responsiveness | Pending |
| React Native app | Future |

---

## LLM Recommendation Engine — Learning Path

_Started: 2026-06-14_

### Why

Chesslens started as an accuracy engine. Accuracy % tells you how well you played — it doesn't tell you what to fix. The next evolution is a personal chess coach: analyze patterns across all your games and tell you exactly what to work on.

**Accuracy engine:** "You played at 78% accuracy."
**Recommendation engine:** "You lose 70% of games that reach move 40+. Your endgame accuracy is 61% vs 76% middlegame. Start with rook and pawn endings."

### Approach

| Phase | Description | Status |
|-------|-------------|--------|
| 1 — Local LLM | Run Ollama on Mac. Experiment with data formats and prompts. Zero cost, fast iteration. | Up next |
| 2 — Integrate into app | Wire recommendation service into backend + new dashboard section. | Pending |
| 3 — Production API | Same prompt, same output — switch config to Claude Haiku or Gemini Flash. | Pending |

### Local Setup (Phase 1)

```bash
brew install ollama
ollama pull llama3.1:8b   # ~4.7GB download
ollama serve              # API at http://localhost:11434
```

Ollama exposes an OpenAI-compatible API. The same client code works for local Ollama and any production API — only the `base_url`, `api_key`, and `model` change in config.

### What the LLM Receives

Structured summary extracted from existing `PlayerProfile` data — not raw PGNs:

```json
{
  "rating": 1420,
  "phase_accuracy": { "opening": 84, "middlegame": 76, "endgame": 61 },
  "openings_as_black": [
    { "name": "French Defense", "games": 40, "win_rate": 22 },
    { "name": "Sicilian Defense", "games": 60, "win_rate": 35 }
  ],
  "game_length": {
    "under_30_moves": { "games": 80, "win_rate": 68 },
    "over_50_moves": { "games": 35, "win_rate": 29 }
  },
  "time_pressure_accuracy_drop": 15
}
```

All of this already exists in `PlayerProfile`. No new Stockfish computation required.

### Output Format

```json
{
  "summary": "Tactical player who wins short games but struggles in long technical battles.",
  "weaknesses": [
    {
      "area": "Endgame",
      "evidence": "61% endgame accuracy vs 76% middlegame; 70% loss rate in games over 50 moves",
      "recommendation": "Practice rook and pawn endgames — specifically up-a-pawn positions.",
      "priority": "high"
    }
  ],
  "strengths": ["Sharp tactical play", "Strong opening preparation as White"],
  "focus_this_week": "Rook and pawn endgames — 3 of your last 5 losses were drawn positions you failed to convert."
}
```

### Quality Bar

A recommendation is good if a chess coach would say it — specific, grounded in the player's actual data, actionable.

| | Bad | Good |
|-|-----|------|
| Endgame | "Improve your endgame." | "Your endgame accuracy is 61%. You're losing won positions after move 40. Study Silman's Complete Endgame Course — rook endings first." |
| Openings | "Play different openings." | "French Defense win rate: 22% over 40 games. At 1420 ELO, the Caro-Kann gives you similar structure with fewer theoretical pitfalls." |

### Experiments Log

| # | Date | Model | What changed | Finding |
|---|------|-------|-------------|---------|
| 1 | TBD | llama3.1:8b | Baseline prompt v1 | TBD |

### Production API Options

| Option | Cost/profile | Monthly (100 users) | Notes |
|--------|-------------|---------------------|-------|
| Ollama local (dev only) | $0 | $0 | Mac only, not for production |
| Claude Haiku 4.5 | ~$0.003 | ~$0.30 | Already integrated |
| Gemini 2.0 Flash | ~$0.001 | ~$0.10 | Cheapest; 1M token context |
| Claude Sonnet 4.6 | ~$0.03 | ~$3.00 | Best quality |

**Target for production:** Gemini 2.0 Flash — cheapest viable option with large enough context to send full game summaries.
