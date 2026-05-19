# Chesslens — Personal Chess Game Reviewer
**Version:** 3.2 · Player Profile Engine | **Status:** Layer 1 + Layer 2 Complete | **Audience:** Individual Chess Players

_Last updated: 2026-05-19 — Session 10_

An AI-powered platform that analyses chess games from Chess.com to build a comprehensive player profile — identifying playing style, opening repertoire, phase accuracy, tactical blind spots, and time pressure patterns — then delivering personalised coaching recommendations. One-click pipeline: import → instant profile → accuracy fills in as a background job.

---

## Distribution Strategy

**Phase 1 (current):** SaaS web application — users access Chesslens via browser, no install required.
**Phase 2:** Mobile app — React Native frontend calling the same FastAPI backend. ~60–70% backend reuse.

**Architectural constraint:** Every decision must be API-first and mobile-ready. The FastAPI backend is the single source of truth for all logic. The web frontend is a thin client — React Native must be able to replace it without backend changes.

---

## User Personas

| Persona | Rating | Plays | Goal |
|---------|--------|-------|------|
| **Rahul — The Improver** | 900–1200 | Daily blitz | Stop making the same blunders. Needs clear, actionable feedback on recurring tactical errors. |
| **Sara — The Repertoire Builder** | 1400–1600 | Rapid & classical | Has 2–3 openings but wants to diversify. Needs style-matched opening recommendations. |
| **Arjun — The Analyst** | 1700+ | Competitive club | Tracks progress rigorously. Wants accuracy trends over time and performance comparison across time controls. |

---

## User Journey (v3 — confirmed Session 7)

```
Home → "Build Your Chess Profile" CTA
  → Register / Sign in
  → Import screen (Chess.com username + filters)
  → Import completes → Layer 1 auto-triggers

Layer 1 (instant — seconds for any game count):
  → Dashboard shows immediately:
      - Rating history
      - Opening repertoire (As White / As Black)
      - Playing style + evidence
      - Coaching recommendations

Layer 2 (automatic, fire-and-forget — no user action needed):
  → Starts automatically after Layer 1 completes
  → Slim non-intrusive banner: "Accuracy analysis running — no need to stay"
  → Accuracy section cards show calm placeholder
    (subtle spinner + chess quote as secondary detail)
  → User can freely leave, browse My Games, or review individual games
  → Wait time scales with game count:
      < 100 games  → seconds  → sections appear, banner may never show
      100–500      → ~15–30s  → user likely stays and sees it fill in
      1,000+       → ~1–2min  → user can leave, comes back to completed profile
  → When done: banner disappears, accuracy sections fill in automatically:
      - Accuracy over time
      - Phase accuracy (opening / middlegame / endgame)
      - Time pressure (normal vs under pressure)
```

**Incremental import (returning user):**
```
My Games → "+ Import Games" → import form
  → New games imported
  → Dashboard shows "Update Profile" button ONLY when
    games.length > profile.game_count_at_last_build
  → User clicks → same Layer 1 + Layer 2 pipeline reruns
  → Button disappears once rebuild starts
```

---

## Feature Pillars

| Pillar | Status |
|--------|--------|
| **Chess.com Import** — date range, game type, time control filters, incremental progress | ✅ Built |
| **Per-Game Review** — board replay, eval bar, eval graph, move classification, Claude summary | ✅ Built |
| **Layer 1 Profile — Instant** — rating history (dual TC dropdowns), W/D/L, White/Black win %, opening repertoire, opponents' openings, playing style, coaching | ✅ Built — frontend + backend |
| **Layer 2 Profile — Accuracy** — auto-triggers after Layer 1; slim banner while running; calm placeholder cards; fills in when done | ✅ Built — frontend + backend |
| **My Games page** — game library, filters, per-game Stockfish, Review | ✅ Built |
| **Scalable Analysis Engine** — opening depth cutoff + critical position detection + FEN dedup cache + Stockfish NNUE depth 1 | ✅ Built |

---

## Feature Specifications

### Layer 1 — Instant Profile (no Stockfish, seconds for any game count)

| Section | Data Source |
|---------|------------|
| Rating history over time | `Game.white_elo / black_elo + played_at` |
| Overall W / D / L | `Game.result` |
| Win % as White and as Black | `Game.result + white_player/black_player` |
| Opening repertoire (As White / As Black, W/D/L) | `Game.opening + result + color` |
| Opponents' openings faced | `Game.opening + color` |
| Playing style classification + evidence | Single Claude synthesis call |
| Coaching recommendations | Single Claude synthesis call |

### Layer 2 — Background Accuracy (selective Stockfish, <60s for 10,000 games)

| Section | Data Source |
|---------|------------|
| Accuracy over time | Stockfish eval on critical positions |
| Phase accuracy (Opening / Middlegame / Endgame) | Move number ranges + Stockfish eval |
| Time pressure (normal vs under pressure) | `[%clk]` PGN annotations + Stockfish eval |
| Blunders / Mistakes / Inaccuracies pattern | Stockfish eval on critical positions |

**While Layer 2 runs:** accuracy sections display rotating chess quotes and trivia to keep the user engaged.

### Scalable Analysis Engine (Layer 2 pipeline)

```
All games → raw positions
      ↓ Opening skip — first 10 half-moves skipped (pure Python, no Polyglot)
Post-opening positions
      ↓ Critical position detection (pure Python)
        captures, checks, moves to squares attacked by opponent non-pawn pieces
~15–20 critical positions per game
      ↓ FEN deduplication + global eval cache (fen_eval_cache table, shared across ALL users)
Cache miss positions only
      ↓ Stockfish NNUE depth 1, single engine reused across games
<60s for 500+ games — accuracy stored per game in GameAnalysis
```

> **Open issue:** Depth-1 produces inflated accuracy values (85–95% vs realistic 65–85%). Goal is to increase to depth 5–8 without compromising the <60s target. Accuracy Over Time chart carries a "trend indicator only" disclaimer until resolved. See `context.md` open issues.

**Performance targets:**
- MVP: < 60s for 10,000 games
- Post-MVP: < 30s (batch neural net, e.g. Maia-style)

### Per-Game Review (unchanged)
- Full board replay with FEN-based position rendering
- Eval bar (vertical, white/black split)
- Eval graph (clickable — click any point to jump to that move)
- Move list with classification symbols (!! ?! ? ??)
- Best-move arrows shown in blue when player played a mistake/blunder
- Last-move squares highlighted in gold
- Board coordinate labels
- Keyboard navigation: ← → ↑ ↓
- Flip board toggle
- Claude narrative summary per game

---

## Scope

### Built

- Chess.com game import (all filters)
- Stockfish per-game evaluation (depth 15)
- Move classification (6 categories)
- Per-game accuracy (Stockfish win-probability formula)
- Full move-by-move Game Review page
- `PlayerProfile` DB model + `GET /profile/me` endpoint + `POST /profile/rebuild`
- Layer 1 profile computation (`services/profile.py`) + Claude synthesis
- **Home page** — "Build your Chess Profile" hero
- **Dashboard** — complete redesign: state machine (empty / build CTA / pipeline running / instant profile / accuracy loading / done / failed)
- **My Games page** — game library with filters, pagination, per-game Stockfish + Review
- **Navbar** — Dashboard + My Games (simplified)
- Chess quotes loading state for accuracy sections
- "Update Profile" button logic (only shows when new games exist since last build)
- JWT auth (email/password + Google OAuth)
- Dark navy UI (Stripe-inspired design system)

### Built — Layer 2 Backend Pipeline (Session 10)

| Item | Status |
|------|--------|
| `fen_eval_cache` DB table + model | ✅ Done |
| `STOCKFISH_BULK_DEPTH=1` config | ✅ Done |
| `services/bulk_analysis.py` — selective pipeline | ✅ Done |
| Wire Layer 2 into `build_profile()` after Layer 1 | ✅ Done |
| Dashboard: poll during Layer 2 run (`layer2Running` condition) | ✅ Done |
| `pollProfile()` store action (silent poll — no loading flash) | ✅ Done |
| Two-column Dashboard layout (Opening Repertoire + Phase/Time Pressure) | ✅ Done |
| W/D/L stacked bar in stats strip | ✅ Done |
| Accuracy Over Time: As White / As Black / All Games toggle + 15-game rolling avg | ✅ Done |
| Accuracy history format `{date, accuracy, color}` — user's own accuracy only | ✅ Done |

### Out of Scope — Not Yet Built

- Mobile responsiveness
- SaaS deployment (Fly.io + Postgres migration)
- User onboarding flow
- React Native mobile app
- Opening explorer
- Subscription / payment system
- Course marketplace
- Social features
- Lichess import (parked, code exists)

---

## Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| No games found on platform | Redirect with disclaimer |
| Fewer than 100 games | Import proceeds with inline warning banner |
| Corrupted / unreadable game | Silently skipped |
| Profile pipeline already running | `POST /profile/create` returns 409 — frontend ignores it |
| Layer 2 data not yet ready | Accuracy sections show chess quotes (rotating, 8s interval) |
| New games imported, no profile built yet | Dashboard shows "Build My Profile" CTA card |
| New games imported after last build | "Update Profile" button appears in Dashboard header |
| No new games since last build | "Update Profile" button never shown |
| Profile analysis fails | Error card + Retry button on Dashboard |
| Non-book opening move | Opening filter stops at deviation point — that position is evaluated (high value) |

---

## Key Performance Indicators

| Metric | Target |
|--------|--------|
| Min recommended games | 100 (for reliable pattern detection) |
| Layer 1 profile build time | < 5 seconds |
| Layer 2 build time (10,000 games) | < 60 seconds (MVP), < 30 seconds (post-MVP) |
| Opening recommendations | 3+ per session |
| Time control filters | 5 categories (bullet / blitz / rapid / classical / chess960) |
| Platforms supported | 1 (Chess.com) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLite (SQLAlchemy) |
| Auth | JWT (access + refresh tokens), SHA-256 pre-hash → bcrypt 3.2.2 |
| Analysis engine — game review | Stockfish CLI depth 15 (subprocess) |
| Analysis engine — bulk profile | Stockfish NNUE depth 1, ProcessPoolExecutor(8 workers) |
| Chess parsing | python-chess (+ Polyglot opening book) |
| AI narrative | Anthropic Claude API (Sonnet for profile, Haiku for per-game) |
| Frontend | React 18 + Vite + TypeScript |
| State management | Zustand (`authStore`, `gameStore`, `filterStore`, `profileStore`) |
| HTTP client | Axios (with token-refresh interceptor) |
| Chess rendering | react-chessboard + chess.js |
| Charts | Recharts |
| Styling | CSS custom properties + inline styles (no Tailwind) |
| Font | Cabinet Grotesk (Google Fonts) |
| Tests | Vitest + jsdom |

### Design Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--navy` | `#0D1B2A` | Page background |
| `--navy-card` | `#132840` | Card background |
| `--navy-raised` | `#1A2E45` | Hover states, panel headers |
| `--blue` | `#2563EB` | Primary CTA, active states, eval graph |
| `--gold` | `#D4A843` | Logo + primary CTA buttons only |
| `--text` | `#F5F0E8` | Primary text |
| `--text-muted` | `#8FA3B8` | Secondary text |
| `--text-dim` | `#4D6A82` | Labels, coordinates |

---

## Backlog (Prioritised)

| Priority | Item |
|----------|------|
| ✅ Done | Google OAuth backend + frontend callback |
| ✅ Done | BUG-A: Game Review screen flickering |
| ✅ Done | BUG-B: Game Review scroll-to-top |
| ✅ Done | Player Profile Engine — Layer 1 (backend + frontend) |
| ✅ Done | Dashboard redesign (state machine, all states, dual TC dropdowns, analysis-unavailable card) |
| ✅ Done | My Games page |
| ✅ Done | Home page redesign |
| 🔴 High | Layer 2 backend pipeline — bulk_analysis + FEN cache + DB migrations |
| 🟡 Medium | Mobile responsiveness (prerequisite for mobile app launch) |
| 🟡 Medium | SaaS deployment (Fly.io + Postgres migration) |
| 🟡 Medium | User onboarding flow |
| 🟢 Low | Hover / micro-animations |
| 🟢 Low | In-app or email notification when analysis completes |
| 🟢 Low | Rate limiting on import endpoints |
| 🔵 Future | Course marketplace (free Lichess material + paid curated content) |
| 🔵 Future | React Native mobile app |
| 🔵 Future | Opening explorer |
| 🔵 Future | Game comparison / social sharing |
| 🔵 Future | Post-MVP: replace Stockfish bulk with Maia-style batch neural net (<30s target) |
