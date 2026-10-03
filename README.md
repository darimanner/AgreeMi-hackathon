# AgreeMi

A workspace where developers and clients agree on requirements. Each project is a chat:
the developer creates it, invites the client with a link, both upload requirement documents,
and an AI assistant reviews them for gaps, contradictions and risks.

Built at a hackathon in April 2026.

## Features

- Chats between developers and clients, joined via an invite code
- Real-time messages over WebSocket
- Document upload (text extracted with markitdown)
- `/analyze`: AI review of a document, findings with severity, saved as versions
- `/diff`: what changed between two analysis versions
- `/summary`: actionable TODO list from the latest analysis
- JWT auth with `client` and `developer` roles

## Stack

| Part | Tech |
|------|------|
| Backend | Python, FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, OpenRouter (OpenAI SDK), uv |
| Frontend | React 19, TypeScript, Vite, Zustand, React Router, react-markdown |
| Deploy | Railway (backend, Docker), Netlify (frontend) |

## Repository layout

```text
backend/    FastAPI API, see backend/docs/API.md and backend/CLAUDE.md
frontend/   React SPA
```

This repo merges two original repositories with full commit history and authorship.

## Running locally

Backend (needs Docker for PostgreSQL):

```bash
cd backend
cp .env.example .env        # set JWT__SECRET and AI__API_KEY
docker compose up -d db
make setup
make start-dev              # http://localhost:8000, Swagger at /docs
```

Frontend:

```bash
cd frontend
cp .env.example .env        # point at a local backend:
                            # VITE_API_PROXY_TARGET=http://localhost:8000
                            # VITE_WS_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:5173
```

## Deploy

- Railway: root directory `/backend`, config file `/backend/railway.toml`
- Netlify: base directory `frontend` (build settings come from `frontend/netlify.toml`)

## Authors

- Kostiantyn Durlov - backend
- Yevhen Hoha - frontend
