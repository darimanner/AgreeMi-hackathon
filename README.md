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
| Deploy | Render Free or Railway (backend, Docker), Neon (PostgreSQL), Netlify (frontend) |

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

### Free stack: Neon + Render + Netlify

1. Database, [Neon](https://neon.com) Free: create a project (AWS Frankfurt, next to the backend) and copy
   the direct (non-pooled) connection string. Convert it for asyncpg: `postgresql://` becomes
   `postgresql+asyncpg://`, `sslmode=require` becomes `ssl=require`, and drop `channel_binding`:

   ```text
   postgresql+asyncpg://USER:PASSWORD@ep-xxx.eu-central-1.aws.neon.tech/neondb?ssl=require
   ```

2. Backend, [Render](https://render.com) Free: New > Blueprint, pick this repo. [`render.yaml`](render.yaml)
   creates the web service. When asked, set `DATABASE__URL` and `DATABASE__DIRECT_URL` to the string from
   step 1 and `AI__API_KEY` to an OpenRouter key; `JWT__SECRET` is generated. Migrations run on start.
3. Frontend, Netlify: base directory `frontend` (build settings come from `frontend/netlify.toml`).
   Replace the Railway URL in `frontend/netlify.toml` (`VITE_WS_URL` and the `/backend/*` redirect)
   with the Render service URL.

Free tier limits to know:

- Render spins the service down after 15 minutes without traffic; the next request waits about a minute.
  750 free instance hours per month, no persistent disk (uploads are stored in PostgreSQL, so nothing is lost).
- Render's own free PostgreSQL expires after 30 days, which is why the database lives on Neon.
- Neon suspends idle compute and caps storage on the Free plan.

### Railway (paid)

Root directory `/backend`, config file `/backend/railway.toml`.

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
