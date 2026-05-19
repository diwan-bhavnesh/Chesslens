# CLAUDE.md

Guidance for Claude Code when working with Chesslens.

## Product Distribution Constraint — Read This First

Chesslens is being built as a **distributable SaaS web application, with mobile app as the next platform.**

This is a hard constraint that governs every architectural decision. Before suggesting any approach, verify it satisfies:

1. **API-first** — All business logic lives in the FastAPI backend. The frontend is a thin client. This ensures React Native (mobile) can call the same API with no backend changes.
2. **No local-only dependencies** — Nothing can assume the user's machine (no local Stockfish path hardcoded for the user, no local file system assumptions). Stockfish runs server-side.
3. **Stateless frontend** — No logic that can't be replicated in React Native later.
4. **Cloud-ready backend** — SQLite is acceptable for now but decisions should not block a future Postgres migration. Avoid SQLite-specific syntax.
5. **No desktop-only patterns** — No Electron, no file system access from the frontend, no native OS APIs.

**Deployment path:** SaaS web app → mobile app (React Native calling same FastAPI). Desktop app is explicitly out of scope.

---

## Communication

- Keep responses short, direct, and factual.
- Avoid hedging language: say what should change, not what might change.
- Flag recurring friction, missing workflows, or better organization immediately.
- Update project knowledge files proactively when the next move is obvious.
- Ask only for judgment calls, major architecture changes, or non-obvious tradeoffs.
- Prefer quality over token efficiency.
- **Always use plain, layman's language.** No technical jargon without an immediate plain-English explanation. Bhavnesh is product-minded — explain the "what" and "why" in simple terms first, technical detail second.
- **Always call out deviations from context.md.** Before starting any task, check whether the proposed approach aligns with the decisions, architecture, and open issues recorded in `context.md`. If the conversation is drifting away from what was agreed — different approach, skipped step, out-of-order build — flag it explicitly before proceeding.

## Regression tests — run after every module

When a new module is built (endpoint, service, pipeline, or frontend feature):
1. **Add tests in parallel** — write a new section in `backend/regression_test.py` covering the new module before or while building it.
2. **Document in `regression.md`** — describe what the new section covers and what constitutes passing.
3. **Run the full suite** — `cd backend && python3 regression_test.py` — all checks must pass.
4. Any new regressions must be fixed before moving on. Do not skip or comment out failing checks.

See `regression.md` for the full test catalogue and planned future sections.

## Delivery checklist — run this after every build session

Before sharing any URL or declaring a feature complete:

1. **Build check** — `cd frontend && npm run build` must pass (zero new TS errors). Known pre-existing errors: two `import.meta.env` TS errors in `src/services/api.ts` and `src/services/auth.ts` — these are acceptable and do not block runtime. Any new errors must be fixed.
2. **Regression suite** — `cd backend && python3 regression_test.py` must pass all checks.
3. **Start services** — ensure both backend (`uvicorn`) and frontend (`npm run dev`) are running.
4. **Smoke test** — manually verify:
   - Email login → Dashboard loads
   - Google OAuth login → redirects correctly (real credentials in `backend/.env` — do not overwrite with placeholders)
   - Import games (Chess.com username) → lands on Dashboard
   - My Games page loads, filters work, Review link works
   - Game Review page opens and loads analysis
   - Any page touched in this session
5. **Only then** share the URL.

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
- `gameStore`: games list, selected game, per-game analysis triggers.
- `filterStore`: filters shared between Dashboard and My Games.
- `profileStore`: player profile + `createProfile()` (POST /profile/create).
- `useAuth` bootstraps auth state on mount by calling `fetchMe()` if a token exists.

Routes:
- `/` — Home
- `/login`, `/register` — Auth
- `/auth/callback` — Google OAuth callback
- `/dashboard` — Player profile (all states: empty / build CTA / running / done / failed)
- `/my-games` — Game library (filters, pagination, per-game Stockfish + Review)
- `/import` — Import games from Chess.com
- `/game/:id` — Per-game review

Polling behavior:
- Dashboard polls `GET /profile/me` every 3s when `profile.status = pending | running`.
- My Games polls pending per-game Stockfish jobs with `refreshGameInList(id)`.
- `fetchGames()` runs only on initial page load.

Auth flow:
- Register/Login call the API, then immediately call `fetchMe()` before navigating to `/dashboard`.
- A failure in `fetchMe()` surfaces as authentication failure.

Import → profile flow:
- After import job status = "done", `ImportGames.tsx` calls `createProfile()` then navigates to `/dashboard`.
- `createProfile()` silently ignores 409 (already running) and any error (e.g. 404 if backend not built yet).
- Dashboard "Build My Profile" button also calls `createProfile()` directly.

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
