# Chesslens

An AI-powered chess analysis platform that imports your games from Chess.com and builds a comprehensive player profile — playing style, opening repertoire, accuracy trends, phase performance, and personalised coaching recommendations.

**Stack:** FastAPI · SQLite · React · Vite · TypeScript · Stockfish · Claude (Anthropic)

---

## What It Does

Import your Chess.com games once. Chesslens runs two analysis layers automatically:

**Layer 1 — Instant** (seconds, no Stockfish)
- Rating history with game-type and time-control filters
- Win / Draw / Loss record and win % as White and Black
- Opening repertoire (As White / As Black / Opponents)
- Playing style classification + evidence bullets
- Personalised coaching recommendations (Claude)

**Layer 2 — Background** (auto-starts after Layer 1, ~15–30s for 500 games)
- Accuracy over time (15-game rolling average, As White / As Black / All)
- Phase accuracy — Opening, Middlegame, Endgame
- Time pressure performance (normal vs under-pressure accuracy)

**My Games** — full game library with:
- User-relative results (Win / Loss / Draw from your perspective, not piece colour)
- Opponent-only column with colour indicator (white/black)
- W/D/L stats strip with stacked bar and win-rate ring
- Filters: Result · Type (Bullet / Blitz / Rapid / Classical / Chess960) · Period
- Sort by Date, Accuracy, or Result
- Inline delete confirmation (no modal)
- Chess960 game support

Per-game review is also available: full board replay, eval bar, eval graph, move classification, best-move arrows, and a Claude narrative summary.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + Uvicorn |
| Database | SQLite (Postgres-ready schema) |
| Chess engine | Stockfish (depth 15 per-game, depth 1 bulk) |
| AI synthesis | Anthropic Claude (style + coaching + per-game summary) |
| Frontend | React 18 + Vite + TypeScript |
| State management | Zustand |
| Charts | Recharts |
| Auth | JWT (email/password) + Google OAuth |

---

## Project Structure

```
chesslens/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, router mounts
│   │   ├── config.py             # Settings (env vars)
│   │   ├── database.py           # SQLAlchemy session
│   │   ├── models/               # ORM models (game.py, user.py)
│   │   ├── routers/              # auth, games, analysis, profile
│   │   └── services/
│   │       ├── profile.py        # Layer 1 computation + Claude synthesis
│   │       ├── bulk_analysis.py  # Layer 2 selective Stockfish pipeline
│   │       ├── stockfish.py      # Per-game depth-15 analysis
│   │       ├── claude.py         # Claude API calls
│   │       └── chesscom.py       # Chess.com archive import
│   ├── regression_test.py        # End-to-end regression suite (95 checks)
│   └── .env                      # Environment variables (not committed)
└── frontend/
    └── src/
        ├── pages/                # Dashboard, MyGames, GameReview, Import…
        ├── store/                # Zustand stores (auth, game, profile, filter)
        ├── services/             # Axios API client
        └── types/                # TypeScript interfaces
```

---

## Local Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- **Stockfish binary** — the chess engine executable must be installed separately on your machine. The Python `stockfish` package (in `requirements.txt`) is only a wrapper that calls the binary; it does not bundle the engine itself.
  - macOS: `brew install stockfish`
  - Linux: `apt install stockfish` or download from [stockfishchess.org](https://stockfishchess.org/download/)
  - Windows: download the `.exe` from [stockfishchess.org](https://stockfishchess.org/download/) and set `STOCKFISH_PATH` in `.env` to the full path
- Anthropic API key
- Google OAuth credentials (for Google sign-in)

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create your env file from the template, then fill in the required values
cp .env.example .env

python3 -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values. The file has inline comments explaining each variable.

**Required to run:**
- `DATABASE_URL` — defaults to SQLite, created automatically
- `SECRET_KEY` — any random string (use `python3 -c "import secrets; print(secrets.token_hex(32))"`)
- `STOCKFISH_PATH` — path to the Stockfish binary on your machine

**Optional (app works without these):**
- `ANTHROPIC_API_KEY` — needed for playing style classification and coaching recommendations. Without it, the profile builds but those sections will be empty.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — needed for "Sign in with Google" only. Email/password registration and login work without it.

> `STOCKFISH_BULK_DEPTH=1` intentionally trades accuracy for speed (<60s for 500+ games). The Accuracy Over Time chart carries a "trend indicator" disclaimer. Increasing to depth 5–8 is a planned improvement.

---

## Running the Regression Suite

With the backend running:

```bash
cd backend
python3 regression_test.py
```

95 checks across 15 sections — auth, game import, Stockfish analysis, player profile (Layer 1 + Layer 2), FEN cache, API availability. All must pass before any session is declared complete.

---

## Architecture Notes

**API-first by design.** All business logic lives in FastAPI. The React frontend is a thin client. A React Native mobile app can call the same API with no backend changes.

**Two-layer profile pipeline:**
- Layer 1 runs from PGN metadata only — no Stockfish. Profile appears in seconds for any game count.
- Layer 2 starts automatically after Layer 1. Selective Stockfish evaluation: skip first 10 half-moves, evaluate only critical positions (captures, checks, sacrifice-candidate squares), cache FEN evals globally across all users. Runs in the background; user can leave the page.

**Auth:** Passwords are SHA-256 pre-hashed before bcrypt to avoid the 72-byte truncation issue. bcrypt is pinned to 3.2.2 (passlib 1.7.4 incompatible with bcrypt ≥ 4.0).

**IDs:** UUIDs stored as 32-character hex strings in SQLite (`String(32)`) — Postgres-compatible without using PostgreSQL UUID types.

---

## Roadmap

- [ ] Increase `STOCKFISH_BULK_DEPTH` to 5–8 for accurate absolute accuracy values (open issue — must not exceed 60s build time)
- [ ] Mobile responsiveness
- [ ] SaaS deployment (Fly.io + Postgres migration)
- [ ] React Native mobile app
- [ ] Lichess import (code exists, parked)
- [ ] Subscription / payment system
- [ ] Opening explorer
