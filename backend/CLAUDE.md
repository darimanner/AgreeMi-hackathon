# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
uv venv && uv sync

# Development (auto-reload, port 8000)
make start-dev

# Production (port 8000)
make start

# Generate migration after model changes
make makemigrations

# Apply migrations
make migrate

# Lint & format
make lint               # ruff check --fix + ruff format

# Add dependency
uv add <package>

# Export requirements.txt (for Docker)
make requirements
```

`PYTHONPATH` must be `src` — all imports are flat: `from config import settings`, not `from src.config import ...`. The Makefile exports this automatically.

**Production (Railway):** runs via Docker + hypercorn on port 8080. Migrations run automatically on `make start`.

## Environment

Copy `.env.example` to `.env`. All nested keys use `__` as delimiter:

```env
PROJECT_NAME="reqlens"
DEBUG=false

# CORS — default ["*"]; restrict in production:
# CORS__ORIGINS=["http://localhost:3000","http://localhost:5173"]

DATABASE__URL=postgresql+asyncpg://user:pass@host:6543/postgres
DATABASE__DIRECT_URL=postgresql+asyncpg://user:pass@host:5432/postgres

JWT__SECRET=<openssl rand -hex 32>
JWT__ALGORITHM=HS256
JWT__EXPIRE_MINUTES=1440

AI__API_KEY=sk-or-...
AI__BASE_URL=https://openrouter.ai/api/v1
AI__MODEL=openai/gpt-oss-120b:free
```

`DATABASE__URL` → `settings.database.url`, `AI__API_KEY` → `settings.ai.api_key`, `CORS__ORIGINS` → `settings.cors_origins`, etc.

## Architecture

```text
src/
  main.py            — FastAPI app, lifespan (DB ping), CORSMiddleware, router registration
  config.py          — pydantic-settings; process exits on missing/invalid env vars
  deps.py            — CurrentUser, DBSession — FastAPI Annotated type aliases
  clients/
    openai_client.py — AsyncOpenAI → OpenRouter; analyze_document(), summarize_messages(), diff_analyses()
  core/
    database.py      — async SQLAlchemy engine + AsyncSessionLocal + get_session()
    logger.py        — structlog (ConsoleRenderer debug / JSONRenderer prod); InterceptHandler
    security.py      — hash_password / verify_password (bcrypt + SHA-256 pre-hash), JWT
    ws_manager.py    — in-memory WebSocket ConnectionManager (single-process)
  models/
    base.py               — DeclarativeBase + TimestampMixin (created_at, updated_at)
    user.py               — User, UserRole (client | developer)
    chat.py               — Chat (invite_code, ai_analysis_json JSONB); chat_developers / chat_clients M2M tables
    message.py            — Message, MessageRole (client | developer | ai | system)
    file.py               — Attachment
    analysis_version.py   — AnalysisVersion (versioned /analyze snapshots per chat)
  routes/
    auth.py          — POST /auth/register, POST /auth/login
    chat.py          — GET /chats, POST /chats, POST /chats/join/{invite_code}
    messages.py      — GET /chats/{id}/messages, POST /chats/{id}/messages
    commands.py      — POST /chats/{id}/commands (/update, /analyze, /diff)
    analysis.py      — POST /chats/{id}/analysis/summary
    ws.py            — WS /ws/{chat_id}?token=
  schemas/
    auth.py          — RegisterRequest, LoginRequest, TokenResponse, UserOut
    chat.py          — ChatCreate, ChatOut, ChatListItem, JoinResponse
    message.py       — MessageOut, AttachmentOut, CommandRequest, CommandResponse
    analysis.py      — AnalysisResult, Finding, FindingSeverity, DiffResult, FindingChange
```

## Data model

```text
User (role: client | developer)
  ├─< Chat via chat_developers  — many developers per chat
  ├─< Chat via chat_clients     — many clients per chat (join via invite_code)
  ├─< Message via author_id     — null = AI or system message
  └─< Attachment via uploaded_by_id

Chat
  ├── invite_code               — URL-safe token for clients to join
  ├── ai_analysis_json (JSONB)  — latest AnalysisResult snapshot
  ├─< Message (ordered by created_at)
  ├─< Attachment (cascade delete)
  └─< AnalysisVersion (ordered by version_number)

AnalysisVersion
  ├── version_number            — 1, 2, 3… per-chat (unique constraint on chat_id + version_number)
  ├── attachment_id             — which file was analyzed (SET NULL on delete)
  └── analysis_json (JSONB)     — full AnalysisResult snapshot at time of /analyze

Message (role: client | developer | ai | system)
  └─< Attachment                — file attached to a specific message

Attachment
  ├── markdown_content          — text extracted from file via markitdown
  ├── ai_analysis               — analysis_markdown text from the last /analyze on this file
  └── model_used                — which AI model ran the analysis
```

## Key conventions

- **Imports**: `from __future__ import annotations` + `TYPE_CHECKING` guard in all model files. All PKs are `uuid.UUID(default=uuid.uuid4)`.
- **Logging**: `logger.info("msg", key=value)` — never `print()`. Import from `core.logger`. Structlog intercepts stdlib logging (uvicorn, hypercorn, alembic, sqlalchemy).
- **Router prefix**: set only in `main.py` via `include_router(..., prefix=...)`. Route files use bare `APIRouter()`.
- **Passwords**: bcrypt with SHA-256 pre-hash (`core/security.py`) — avoids bcrypt's 72-byte truncation limit.
- **AI errors**: always propagate through `_raise_for_ai_error()` in `clients/openai_client.py` — maps OpenRouter status codes to proper HTTP responses (401→502, 429→429, 5xx→503, timeout→504).
- **AI JSON robustness**: `_extract_json()` strips markdown fences, `_sanitize_json()` escapes bare control chars, automatic retry with `_FIX_SYSTEM_PROMPT` at temperature=0.0, fallback `AnalysisResult` if both fail. Same pattern for diff.
- **WebSocket**: in-memory `ConnectionManager` — works for single process only. Replace `broadcast()` with Redis Pub/Sub for multi-worker.
- **AI model**: configured via `AI__MODEL` env var (default `openai/gpt-oss-120b:free`). `max_tokens=50_000` for analyze/diff, `max_tokens=500` for /summary, `max_tokens=300` for /update.
- **Analysis versioning**: `/analyze` creates an `AnalysisVersion` record; `/diff` and `/summary` always fetch the latest by `version_number DESC` — never stale cache.
- **CORS**: `CORSMiddleware` added in `main.py`. Default `allow_origins=["*"]`; override with `CORS__ORIGINS` env var.
- **Participant check**: LEFT JOIN pattern in `_assert_participant` / `_get_participant_chat` — 1 DB round trip instead of 3.
- **HTTPException propagation**: If an AI call raises `HTTPException` (429/503/504 from `_raise_for_ai_error`), re-raise it before catching generic `Exception`.
- **MissingGreenlet fix**: use `attributes.set_committed_value(message, "attachments", [...])` instead of direct assignment after async commit.
