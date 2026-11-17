# AgreeMi

[![Live demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square)](https://willowy-kitsune-1a8665.netlify.app)
[![Netlify Status](https://api.netlify.com/api/v1/badges/5ad7f4c7-b691-4ad5-9925-44e5223e3982/deploy-status)](https://app.netlify.com/projects/willowy-kitsune-1a8665/deploys)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](backend/pyproject.toml)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](frontend/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-6566F1?style=flat-square&logo=openrouter&logoColor=white)](https://openrouter.ai)

[![Frontend on Netlify](https://img.shields.io/badge/frontend-Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white)](https://willowy-kitsune-1a8665.netlify.app)
[![Backend on Render](https://img.shields.io/badge/backend-Render-46E3B7?style=flat-square&logo=render&logoColor=black)](https://agreemi-backend.onrender.com/docs)
[![Database on Neon](https://img.shields.io/badge/database-Neon-00E599?style=flat-square&logo=neon&logoColor=black)](https://neon.com)

**Live demo: https://willowy-kitsune-1a8665.netlify.app** (free hosting: the backend sleeps when idle, so the
first request can take about a minute). AI features need your own [OpenRouter key](https://openrouter.ai/keys):
add it in Settings on the chats page. Free models work with a free key.

A workspace where developers and clients agree on requirements. Each project is a chat:
the developer creates it, invites the client with a link, both upload requirement documents,
and an AI assistant reviews them for gaps, contradictions and risks.

Built at a hackathon in April 2026. [Transilvania CodeStorm@MI 2026](https://mateinfo.unitbv.ro/ro/evenimente/656-transilvania-codestorm-mi-2026-hackathon.html)

## Features

- Chats between developers and clients, joined via an invite code
- Real-time messages over WebSocket
- Document upload (text extracted with markitdown)
- `/analyze`: AI review of a document, findings with severity, saved as versions
- `/diff`: what changed between two analysis versions
- `/summary`: actionable TODO list from the latest analysis
- Bring your own OpenRouter key: each user can add a key in Settings; the server key is an optional fallback
- JWT auth with `client` and `developer` roles

## Stack

| Part | Tech |
|------|------|
| Backend | Python, FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, OpenRouter (OpenAI SDK), uv |
| Frontend | React 19, TypeScript, Vite, Zustand, React Router, react-markdown |
| Deploy | Render Free (backend, Docker), Neon (PostgreSQL), Netlify (frontend) |

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
cp .env.example .env        # set JWT__SECRET; AI__API_KEY is optional (users can add their own key)
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

### Free stack: Neon + Render + Netlify

1. Database, [Neon](https://neon.com) Free: create a project (AWS Frankfurt, next to the backend) and copy
   the direct (non-pooled) connection string. Paste it as is: the backend rewrites `postgresql://` and
   `sslmode` for asyncpg.
2. Backend, [Render](https://render.com) Free: New > Blueprint, pick this repo. [`render.yaml`](render.yaml)
   creates the web service. When asked, set `DATABASE__URL` and `DATABASE__DIRECT_URL` to the string from
   step 1; `JWT__SECRET` is generated. No OpenRouter key is needed on the server: users add their own.
   Set `AI__API_KEY` only if the server should pay for users without a key. Migrations run on start.
3. Frontend, Netlify: base directory `frontend` (build settings come from `frontend/netlify.toml`).
   Put your Render service URL into `VITE_API_URL` and `VITE_WS_URL` there. The browser calls Render
   directly, because Netlify's proxy times out before a sleeping Render service wakes up.

Free tier limits to know:

- Render spins the service down after 15 minutes without traffic; the next request waits about a minute.
  750 free instance hours per month, no persistent disk (uploads are converted to text and stored in PostgreSQL,
  so nothing is lost).
- Render's own free PostgreSQL expires after 30 days, which is why the database lives on Neon.
- Neon suspends idle compute and caps storage on the Free plan.

## Team

Built by a team of three with equal contribution: ideas and key decisions were shared.

- [Kostiantyn Durlov](https://www.linkedin.com/in/kostiantyn-durlov/) - backend: AI features and chat, structured AI output,
  document analysis features, model selection with cost estimates, deployment
- [Yevhen Hoha](https://www.linkedin.com/in/yevhen-hoha/) - frontend: analysis and change review features, landing page, demo
- [Oleksii Pavlov](https://www.linkedin.com/in/pavlov-oleksii/) - frontend architecture, expanding the idea and its use cases,
  branding, final pitch

After the hackathon, Kostiantyn maintains the backend and Yevhen the frontend.

## License

[Apache License 2.0](LICENSE). You are free to use, modify and redistribute the code, as long as you
keep the [NOTICE](NOTICE) file and credit the original source:
https://github.com/darimanner/AgreeMi-hackathon
