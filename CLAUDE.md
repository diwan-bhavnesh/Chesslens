# CLAUDE.md

Guidance for Claude Code when working with Chesslens.

## Communication

- Keep responses short, direct, and factual.
- Avoid hedging language: say what should change, not what might change.
- Flag recurring friction, missing workflows, or better organization immediately.
- Update project knowledge files proactively when the next move is obvious.
- Ask only for judgment calls, major architecture changes, or non-obvious tradeoffs.
- Prefer quality over token efficiency.

## Useful commands

Backend:
```bash
cd backend
python3 -m uvicorn app.main:app --reload --port 8000
```
Frontend:
```bash
cd frontend
npm run dev
npm run build
npm lint
npm test
npm run test:watch
```

Note: `npm run build` currently shows two known `import.meta.env` TS errors in `src/services/api.ts` and `src/services/auth.ts`. These are frontend type issues only and do not block runtime.

## Architecture overview

### Backend

- FastAPI app in `backend/app/main.py`.
- Routers mounted: `/auth`, `/users`, `/games`, `/analysis`.
- Protected endpoints use `app/routers/deps.py::get_current_user` with Bearer JWT auth.

Key constraints:
- UUIDs are stored as 32-character hex strings in SQLite using `String(32)`, not PostgreSQL UUID types.
- Normalize IDs with `uuid.UUID(...).hex` before queries.
- Passwords are prehashed with SHA-256 before bcrypt to avoid the 72-byte truncation issue.
- bcrypt is pinned to `3.2.2`; do not upgrade.

Analysis flow:
- `POST /analysis/{game_id}` creates a placeholder `GameAnalysis` row.
- A `BackgroundTask` runs `_run_analysis`, opens a new DB session, runs Stockfish via `services/stockfish.py`, then generates narrative text via `services/claude.py`.
- `Game` to `GameAnalysis` is one-to-one; `Move` rows are ordered by `move_number`.

External imports:
- `services/chesscom.py` walks Chess.com monthly archives newest-first until `max_games` is reached.
- `max_games=0` means fetch all available games.

### Frontend

- React + Vite app under `frontend/`.
- Single Axios instance in `src/services/api.ts` using `VITE_API_BASE_URL`.
- Response interceptor refreshes access tokens and redirects to `/login` if refresh fails.

State management:
- `authStore`: current user + loading state.
- `gameStore`: games, selected game, analysis triggers.
- `filterStore`: dashboard filters.
- `useAuth` bootstraps auth state on mount by calling `fetchMe()` if a token exists.

Polling behavior:
- Dashboard polls pending Stockfish jobs with `refreshGameInList(id)`.
- This updates only the affected game row and avoids UI flicker or scroll resets.
- `fetchGames()` runs only on initial dashboard load.

Auth flow:
- Register/Login call the API, then immediately call `fetchMe()` before navigating to `/dashboard`.
- A failure in `fetchMe()` surfaces as authentication failure.

Design system:
- Global styles in `src/index.css`.
- No Tailwind or CSS modules; layout uses inline styles and utility classes.
- Color tokens:
  - `--navy`: `#0D1B2A`
  - `--navy-card`: `#132840`
  - `--navy-raised`: `#1A2E45`
  - `--blue`: `#2563EB`
  - `--gold`: `#D4A843` (logo + primary CTA only)
  - `--text`: `#F5F0E8`
  - `--text-muted`: `#8FA3B8`
  - `--text-dim`: `#4D6A82`

## Environment

Backend config: `backend/.env`
Required vars:
- `DATABASE_URL`
- `SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
