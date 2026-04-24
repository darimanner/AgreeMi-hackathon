from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import settings
from core.database import engine
from core.logger import logger, setup_logging
from routes import (
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

    On startup: verify database connectivity.
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
# WebSocket
# ------------------------------------------------------------------
app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])
