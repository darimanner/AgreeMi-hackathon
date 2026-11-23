from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from core.cleanup import delete_stale_data
from core.database import AsyncSessionLocal, engine
from core.logger import logger, setup_logging
from routes import (
    analysis_router,
    auth_router,
    chat_router,
    commands_router,
    messages_router,
    ws_router,
)

setup_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Manage application lifecycle.

    On startup: verify database connectivity, delete stale chats and accounts.
    On shutdown: dispose the connection pool.
    """
    # Verify the database is reachable before accepting traffic.
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_host = settings.database.url.split("@")[-1]
        logger.info("Database connection verified", host=db_host)
    except Exception as exc:
        logger.error("Database connection failed on startup", error=str(exc))
        raise

    # Render's free instance restarts after every idle spell, so this runs often enough without a cron.
    try:
        async with AsyncSessionLocal() as session:
            await delete_stale_data(session)
    except Exception as exc:
        logger.error("Stale data cleanup failed", error=str(exc))

    logger.info("ReqLens started", project=settings.project_name, debug=settings.debug)
    yield

    await engine.dispose()
    logger.info("ReqLens shut down — connection pool disposed")


app = FastAPI(
    title="ReqLens API",
    description="Client-developer communication platform with AI analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
app.include_router(auth_router, prefix="/auth", tags=["Auth"])

# ------------------------------------------------------------------
# Chat rooms
# ------------------------------------------------------------------
app.include_router(chat_router, prefix="/chats", tags=["Chats"])

# ------------------------------------------------------------------
# Messages (prefix /chats so paths resolve to /chats/{id}/messages)
# ------------------------------------------------------------------
app.include_router(messages_router, prefix="/chats", tags=["Messages"])

# ------------------------------------------------------------------
# Slash commands
# ------------------------------------------------------------------
app.include_router(commands_router, prefix="/chats", tags=["Commands"])

# ------------------------------------------------------------------
# Analysis (summary, etc.)
# ------------------------------------------------------------------
app.include_router(analysis_router, prefix="/chats", tags=["Analysis"])

# ------------------------------------------------------------------
# WebSocket
# ------------------------------------------------------------------
app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


# ------------------------------------------------------------------
# Health check (Render healthCheckPath)
# ------------------------------------------------------------------
@app.get("/health", tags=["Health"], summary="Health check")
async def health() -> dict[str, str]:
    return {"status": "ok"}
