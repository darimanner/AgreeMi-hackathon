# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
uv venv && uv sync

# Development (auto-reload, port 8001)
make start-dev
# or:
PYTHONPATH=src uv run uvicorn src.main:app --port 8001 --reload

# Production (port 8001)
make start

# Lint & format
make lint               # ruff check --fix + ruff format

# Add dependency
uv add <package>

# Export requirements.txt (for Docker)
make requirements
```

`PYTHONPATH` must be `src` — all imports are flat: `from config import settings`, not `from src.config import ...`. The Makefile exports this automatically.

**Production (Railway):** runs via Docker + hypercorn on port 8080.

## Environment

Copy `.env.example` to `.env`. All nested keys use `__` as delimiter:

```
PROJECT_NAME="reqlens"
DEBUG=false

DATABASE__URL=postgresql+asyncpg://user:pass@host:6543/postgres
DATABASE__DIRECT_URL=postgresql+asyncpg://user:pass@host:5432/postgres

JWT__SECRET=<openssl rand -hex 32>
JWT__ALGORITHM=HS256
JWT__EXPIRE_MINUTES=1440

AI__API_KEY=sk-or-...
AI__BASE_URL=https://openrouter.ai/api/v1
AI__MODEL=openai/gpt-oss-120b:free
```

`DATABASE__URL` → `settings.database.url`, `AI__API_KEY` → `settings.ai.api_key`, etc.

## Architecture

```
src/
  main.py            — FastAPI app ("ReqLens API"), lifespan (DB ping), router registration
  config.py          — pydantic-settings; process exits on missing/invalid env vars
  deps.py            — CurrentUser, DBSession — FastAPI Annotated type aliases
  clients/
    openai_client.py — AsyncOpenAI → OpenRouter; analyze_document(), summarize_messages()
  core/
    database.py      — async SQLAlchemy engine + AsyncSessionLocal + get_session()
    logger.py        — structlog (ConsoleRenderer debug / JSONRenderer prod); InterceptHandler
    security.py      — hash_password / verify_password (bcrypt + SHA-256 pre-hash), JWT
    ws_manager.py    — in-memory WebSocket ConnectionManager (single-process)
  models/
    base.py          — DeclarativeBase + TimestampMixin (created_at, updated_at)
    user.py          — User, UserRole (client | developer)
    chat.py          — Chat (invite_code, ai_analysis_json JSONB)
    message.py       — Message, MessageRole (client | developer | ai | system)
    file.py          — Attachment
  routes/
    auth.py          — POST /auth/register, POST /auth/login
    chat.py          — GET /chats, POST /chats, POST /chats/join/{invite_code}
    messages.py      — GET /chats/{id}/messages, POST /chats/{id}/messages
    commands.py      — POST /chats/{id}/commands (/update, /analyze)
    ws.py            — WS /ws/{chat_id}?token=
  schemas/
    auth.py          — RegisterRequest, LoginRequest, TokenResponse, UserOut
    chat.py          — ChatCreate, ChatOut, ChatListItem, JoinResponse
    message.py       — MessageOut, AttachmentOut, CommandRequest, CommandResponse
    analysis.py      — AnalysisResult, AnalysisIssue, IssueSeverity
```

## Data model

```
User (role: client | developer)
  ├─< Chat via developer_id   — developer creates the chat room
  ├─< Chat via client_id      — client joins via invite_code (nullable until joined)
  ├─< Message via author_id   — null = AI or system message
  └─< Attachment via uploaded_by_id

Chat
  ├── invite_code             — URL-safe 11-char token for client to join
  ├── ai_analysis_json (JSONB)— {score, summary, issues[{id,severity,title,description,suggestion}]}
  ├─< Message (ordered by created_at)
  └─< Attachment (cascade delete)

Message (role: client | developer | ai | system)
  └─< Attachment              — file attached to a specific message

Attachment
  ├── markdown_content        — text extracted from file via markitdown
  ├── ai_analysis             — raw LLM text response
  └── model_used              — which model ran the analysis
```

## Key conventions

- **Imports**: `from __future__ import annotations` + `TYPE_CHECKING` guard in all model files. All PKs are `uuid.UUID(default=uuid.uuid4)`.
- **Logging**: `logger.info("msg", key=value)` — never `print()`. Import from `core.logger`. Structlog intercepts stdlib logging (uvicorn, hypercorn, alembic, sqlalchemy).
- **Router prefix**: set only in `main.py` via `include_router(..., prefix=...)`. Route files use bare `APIRouter()`.
- **Passwords**: bcrypt with SHA-256 pre-hash (`core/security.py`) — avoids bcrypt's 72-byte truncation limit.
- **AI errors**: always propagate through `_raise_for_ai_error()` in `clients/openai_client.py` — maps OpenRouter status codes to proper HTTP responses (401→502, 429→429, 5xx→503, timeout→504).
- **WebSocket**: in-memory `ConnectionManager` — works for single process only. Replace `broadcast()` with Redis Pub/Sub for multi-worker.
- **AI model**: configured via `AI__MODEL` env var (default `openai/gpt-oss-120b:free`).
