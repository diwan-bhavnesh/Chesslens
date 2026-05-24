# Chesslens — Production Deployment Guide

> **Status:** Plan drafted. Not yet deployed. MVP target: Fly.io (backend) + Vercel (frontend) + Fly.io Postgres.

---

## Infrastructure

| Layer | Service | Cost |
|-------|---------|------|
| **Backend** | [Fly.io](https://fly.io) — `performance-1x` | ~$10/mo |
| **Database** | Fly.io Postgres | Free tier or ~$7/mo |
| **Frontend** | [Vercel](https://vercel.com) Hobby | Free |

- Backend URL: `https://chesslens-api.fly.dev`
- Frontend URL: `https://chesslens.vercel.app`

---

## MVP Scope: AI Layer

All Stockfish features ship. The Claude AI layer (Playing Style, Coaching, per-game narrative) is hidden for MVP by leaving `ANTHROPIC_API_KEY` empty — those sections gracefully return `null` and the frontend renders nothing. Re-enabling later requires only setting the key and redeploying.

---

## Files to Create

### `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y stockfish && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `backend/.dockerignore`

```
__pycache__/
*.pyc
.env
*.db
venv/
.venv/
regression_test.py
reset_bulk_analysis.py
```

### `backend/fly.toml`

```toml
app = "chesslens-api"
primary_region = "sin"

[build]
  dockerfile = "Dockerfile"

[deploy]
  release_command = "alembic upgrade head"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "1gb"
  cpu_kind = "performance"
  cpus = 1
```

### `frontend/vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Alembic Setup (Database Migrations)

Alembic is in `requirements.txt` but not yet initialised. Run once locally:

```bash
cd backend
alembic init migrations
```

Configure `alembic.ini` — remove the hardcoded `sqlalchemy.url` line.

Configure `migrations/env.py`:

```python
import os
from app.models.game import Game, GameAnalysis, Move, BatchAnalysis, FenEvalCache
from app.models.user import User
from app.models.profile import PlayerProfile
from app.database import Base

config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
target_metadata = Base.metadata
```

Generate baseline migration:

```bash
alembic revision --autogenerate -m "baseline_schema"
alembic upgrade head   # verify locally with SQLite first
```

Guard `Base.metadata.create_all()` in `app/main.py` for dev-only:

```python
import os
if os.getenv("APP_ENV", "development") == "development":
    Base.metadata.create_all(bind=engine)
```

---

## Environment Variables

### Fly.io Secrets (backend)

```bash
fly secrets set \
  DATABASE_URL="postgres://..."                                          \
  SECRET_KEY="$(openssl rand -hex 32)"                                  \
  GOOGLE_CLIENT_ID="<from Google Console>"                              \
  GOOGLE_CLIENT_SECRET="<from Google Console>"                          \
  GOOGLE_REDIRECT_URI="https://chesslens-api.fly.dev/auth/google/callback" \
  ANTHROPIC_API_KEY=""                                                   \
  STOCKFISH_PATH="/usr/games/stockfish"                                 \
  STOCKFISH_DEPTH="12"                                                  \
  STOCKFISH_BULK_DEPTH="5"                                              \
  FRONTEND_URL="https://chesslens.vercel.app"                           \
  CORS_ORIGINS="https://chesslens.vercel.app"                           \
  APP_ENV="production"
```

### Vercel Environment Variables (frontend)

Set in Vercel dashboard → Project → Settings → Environment Variables:

```
VITE_API_BASE_URL     = https://chesslens-api.fly.dev
VITE_GOOGLE_CLIENT_ID = <same Google client ID>
```

### Google OAuth Console

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client:

- **Authorised JavaScript origins:** Add `https://chesslens.vercel.app`
- **Authorised redirect URIs:** Add `https://chesslens-api.fly.dev/auth/google/callback`

---

## Deployment Steps

```bash
# 1. Install Fly CLI
brew install flyctl && fly auth login

# 2. Initialise Alembic locally (one-time)
cd backend
alembic init migrations
# configure alembic.ini + migrations/env.py as above
alembic revision --autogenerate -m "baseline_schema"

# 3. Create Fly app and Postgres
fly launch --name chesslens-api --region sin --no-deploy
fly postgres create --name chesslens-db --region sin
fly postgres attach chesslens-db   # auto-sets DATABASE_URL secret

# 4. Set remaining secrets
fly secrets set SECRET_KEY="..." GOOGLE_CLIENT_ID="..." ...

# 5. Deploy backend (Alembic runs via release_command, then app starts)
fly deploy

# 6. Verify backend
curl https://chesslens-api.fly.dev/health   # → {"status": "ok"}

# 7. Deploy frontend
cd ../frontend
npx vercel --prod
# Set VITE_API_BASE_URL + VITE_GOOGLE_CLIENT_ID in Vercel dashboard

# 8. Update Google OAuth redirect URIs (Google Cloud Console)
```

---

## Post-Deploy Verification

1. `curl https://chesslens-api.fly.dev/health` → `{"status": "ok"}`
2. `https://chesslens-api.fly.dev/docs` → Swagger UI loads
3. Frontend home page loads, no console errors
4. Register new account → dashboard loads
5. Google OAuth login → redirects correctly
6. Import Chess.com games → Layer 1 profile appears, Layer 2 accuracy fills in
7. My Games → Review → "Preparing…" → Game Review with move-by-move analysis

---

## Enabling the AI Layer Post-MVP

When ready to unlock Playing Style, Coaching, and per-game AI summaries:

```bash
fly secrets set ANTHROPIC_API_KEY="sk-ant-..."
fly deploy
```

No frontend or database changes needed.
