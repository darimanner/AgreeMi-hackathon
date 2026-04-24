# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
uv venv && uv sync

# Development server (auto-reload)
make start-dev          # uvicorn on :8001 with reload
# or directly:
PYTHONPATH=src uv run uvicorn src.main:app --port 8001 --reload

# Production server
make start              # uvicorn on :8001

# Lint & format
make lint               # ruff check --fix + ruff format

# Add dependencies
uv add <package>

# Export requirements (for Docker)
make requirements
```

`PYTHONPATH` must be `src` — all imports are flat: `from config import settings`, not `from src.config import ...`. The Makefile exports this automatically.

## Environment

Copy `.env.example` to `.env`:

```
PROJECT_NAME="prism-backend-2026"
DEBUG=false
API_TOKENS__OPENROUTER=sk-or-...
```

`pydantic-settings` uses `__` as the nested delimiter → `API_TOKENS__OPENROUTER` maps to `settings.api_tokens.openrouter`.

## Architecture

```
src/
  main.py          — FastAPI app, lifespan, router registration
  config.py        — pydantic-settings; crashes at startup on missing env vars
  deps.py          — FastAPI DI (placeholder)
  clients/
    openrouter.py  — AsyncOpenAI → OpenRouter; send_message(), analyze_pdf_markdown()
  core/
    logger.py      — structlog; ConsoleRenderer (DEBUG=true), JSONRenderer (prod)
    prompts.py     — LLM system prompts (ANALYZE_PDF_PROMPT)
  models/          — SQLAlchemy 2.0 async ORM models
    base.py        — DeclarativeBase + TimestampMixin (created_at, updated_at)
    user.py        — User, UserRole (client | developer)
    chat.py        — Chat (invite_code, ai_analysis_json JSONB)
    message.py     — Message, MessageRole (client | developer | ai | system)
    file.py        — Attachment (linked to chat + optional message)
  routes/
    analyze.py     — POST /api/analyze/pdf
  schemas/
    schemas.py     — AnalyzePDFResponse
    clients.py     — ChatRequest / ChatResponse
```

## Data model

```
User (role: client | developer)
  ├─< Chat via developer_id   — developer creates the chat
  ├─< Chat via client_id      — client joins via invite_code
  ├─< Message via author_id   — null author = AI or system message
  └─< Attachment via uploaded_by_id

Chat
  ├── invite_code             — URL-safe 11-char token, used by client to join
  ├── ai_analysis_json        — JSONB: {score, summary, issues[]}
  ├─< Message (ordered by created_at)
  └─< Attachment

Message (role: client | developer | ai | system)
  └─< Attachment              — files attached to a specific message

Attachment
  ├── markdown_content        — PDF extracted via markitdown
  ├── ai_analysis             — raw LLM response text
  └── ai_analysis_json        — structured result lives on Chat
```

## Key conventions

- **Models**: use `from __future__ import annotations` + `TYPE_CHECKING` guard for cross-model imports. All PKs are `uuid.UUID` with `default=uuid.uuid4`.
- **Logging**: `logger.info("msg", key=value)` — never `print()`. Logger from `core.logger`.
- **Router prefix**: prefix set in `main.py` via `include_router(..., prefix=...)`. Router files use bare `APIRouter()` with no prefix.
- **Default LLM model**: `meta-llama/llama-3.3-8b-instruct:free` (`DEFAULT_MODEL` in `clients/openrouter.py`).
- **PDF flow**: `UploadFile` → `markitdown.convert_stream()` → markdown string → OpenRouter → `Attachment` stored in DB.
