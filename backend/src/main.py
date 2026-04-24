from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import settings
from core.logger import logger, setup_logging
from routes import analyze_router, chat_router

setup_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    logger.info("Application started successfully")
    yield
    logger.info("Application shutting down...")


app = FastAPI(
    title=settings.project_name,
    lifespan=lifespan,
)

app.include_router(analyze_router, prefix="/api/analyze", tags=["Analyze"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
