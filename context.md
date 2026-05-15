# Chesslens — Project Context

_Last updated: 2026-05-12 — Session 3 | Lichess removed from UI to keep MVP simple_

> **Full product requirements:** See [`PRD.md`](./PRD.md) — personas, user journey, feature specs, KPIs, backlog.

---

## What's Built

### Backend (FastAPI + SQLite)

| Area | Status |
|------|--------|
| Auth — email/password (JWT + refresh token) | ✅ Done |
| Auth — Google OAuth button (frontend only) | ⚠️ Partial — backend callback unclear |
| User model + `/users/me` endpoint | ✅ Done |
| Game import — Chess.com (monthly archive walk) | ✅ Done |
| Game model + Move model (UUID hex PKs) | ✅ Done |
| Tier 1 analysis — Claude portfolio/batch (`POST /analysis/batch`) | ✅ Done |
| Tier 2 analysis — Stockfish per-game (`POST /analysis/{game_id}`) | ✅ Done |
| Move classification (brilliant/best/good/inaccuracy/mistake/blunder) | ✅ Done |
| Accuracy % calculation (Stockfish win-probability formula) | ✅ Done |
| Key moments extraction (eval drop ≥ 1.5 pawns) | ✅ Done |
| Claude narrative summary per game | ✅ Done |
| Delete game / clear all games | ✅ Done |
| Password: SHA-256 pre-hash → bcrypt (72-byte bypass) | ✅ Done |

### Frontend (React + Vite + TypeScript)

| Area | Status |
|------|--------|
| Auth pages — Login, Register | ✅ Done |
| Google OAuth button (UI only) | ⚠️ Partial |
| Zustand stores — `authStore`, `gameStore`, `filterStore` | ✅ Done |
| Token refresh interceptor (Axios) | ✅ Done |
| Dashboard — game list with filters (result, time control, date) | ✅ Done |
| Dashboard — opening stats, tactical patterns, opening recommendations | ✅ Done |
| Dashboard — batch analysis trigger + status | ✅ Done |
| Import Games page — date range, game type, time control filters | ✅ Done |
| Game Review page — Chessboard, EvalBar, EvalGraph, MoveList, AnalysisPanel | ✅ Done |
| Keyboard navigation (arrow keys) in Game Review | ✅ Done |
| Best-move arrows on board | ✅ Done |
| Flip board toggle | ✅ Done |
| Board coordinate labels | ✅ Done |
| Analysis poll — silent per-game refresh (no flicker, no scroll reset) | ✅ Done |
| Full dark navy rebrand (Stripe-inspired) — navy/blue/gold palette | ✅ Done |
| Gold accent restricted to logo + primary CTA only | ✅ Done |
| Vitest test suite — 17 passing utility tests | ✅ Done |
| Home page | ✅ Done |
| **Regression tests** — 59/59 passing (signup → import → analysis → auth hardening) | ✅ Done |

---

## Session 3 Decisions (2026-05-12)

**Lichess Removed from MVP**
- Decided to keep things simple: Chess.com only for now
- Removed from: UI (Import page platform selector), backend routers, type definitions, documentation
- Still available: Lichess service code (`services/lichess.py`) and config remain in backend for future use
- Can be re-added anytime post-MVP with minimal effort

---

## Open Issues & Priority

| Priority | Issue | Notes |
|----------|-------|-------|
| 🔴 High | Google OAuth backend not wired | Button exists on frontend, no backend callback handler confirmed |
| ✅ Done | Typography hierarchy too flat | Fixed: SectionCard titles → 1rem/700, player name → 15px, move list font → 15px |
| ✅ Done | Gold accent overloaded | Fixed: gold restricted to logo + primary CTA; accuracy % → #F5F0E8; eval graph → #2563EB; best move → #F5F0E8 |
| ✅ Done | Dashboard outer padding too generous | Fixed: maxWidth 1100→1280, padding 2.5rem→1.5rem 2rem, stats gap 0.875rem→1rem |
| ✅ Done | GameReview move list too narrow | Fixed: 220px → 260px |
| ✅ Done | No tabular-nums on stats/ratings | Fixed: tabular-nums on ELO rows and stat card values |
| ✅ Done | Card elevation too subtle | Fixed: --navy-card #112236→#132840, box-shadow added to .card and SectionCard |
| ✅ Done | Board has no coordinate labels | Fixed: showBoardNotation=true with #4D6A82 notation color |
| ✅ Done | Dashboard flicker on Run Stockfish | Fixed: polling now calls `refreshGameInList(id)` (silent single-row patch) instead of `fetchGames()` — no isLoading toggle, no scroll reset |
| ✅ Done | Import page "Number of games" filter | Removed — imports now always fetch all games (max_games: 0) |
| ✅ Done | Raw JSON shown in portfolio error banner | Fixed: `cleanApiError()` extracts the human-readable `message` field from the backend error string |
| 🟢 Low | `bcrypt` pinned to 3.2.2 | Cannot upgrade — passlib 1.7.4 incompatible with bcrypt ≥ 4.0 |

---

## Design System — Current State

All typography, spacing, and colour fixes from the Session 2 peer analysis have been implemented. Key rules to preserve:

- **Gold (`#D4A843`):** logo + primary CTA buttons only — do not introduce elsewhere
- **Eval graph line:** `#2563EB` (blue) — not gold
- **Accuracy % and best move:** `#F5F0E8` (warm white) — not gold
- **Card bg:** `--navy-card: #132840` with `box-shadow: 0 1px 3px rgba(0,0,0,0.4)`
- **Dashboard:** `maxWidth: 1280`, `padding: 1.5rem 2rem`

---

## Analysis Architecture — Token Optimization (2026-05-10)

**Problem:** Anthropic API rate limits hit when analysing large portfolios (1000+ games). Current `analyze_portfolio()` sends raw move data to Claude, resulting in ~1M tokens per batch.

**Recommendation: Hybrid approach (Rule-based extraction + Claude synthesis)**

Extract patterns programmatically first, then use Claude only for narrative synthesis:

1. **Parse all games programmatically** (Python, no API calls):
   - Count openings by ECO code
   - Calculate accuracy % per time period (trending)
   - Average engine evaluation by phase (opening/middlegame/endgame)
   - Identify repertoire gaps (openings never played, common opponent openings undefended against)

2. **Store structured data** in database or as intermediate JSON

3. **Send Claude only the summary** (~200 chars of aggregated data instead of 40,000 raw moves)

**Token reduction:** 1,050,000 → 2,500 (~99.7% savings), instant pattern extraction, quality synthesis maintained.

**Implementation note:** Do NOT require external chess datasets (PGN databases, grandmaster games) for MVP. Ship with extracted self-data only. Add comparative analysis (vs GM patterns, opening theory) post-PMF if valuable.

**Why this works for MVP:** Users validate the analysis is useful *before* you invest in scaling or external data infrastructure.

---

## Parked — Next Visual Upgrades

These were discussed on 2026-05-10 but not yet prioritised:

| Item | Notes |
|------|-------|
| Mobile responsiveness | No responsive breakpoints exist anywhere yet |
| Hover / micro-animations | Cards, buttons, nav — add subtle transitions to feel more polished |
| Home page redesign | Current page is minimal; could be more of a proper landing/marketing page |
| Deployment / hosting plan | Not started |
| User-facing onboarding flow | First-time experience (empty state → import → analyse) not guided |
| Notifications when analysis completes | No email or in-app notification when batch analysis finishes |
| Rate limiting on import endpoints | No abuse protection on Chess.com import |
| Opening explorer | Not in scope yet |
| Game comparison / social sharing | Not in scope yet |
