from pydantic import BaseModel, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.logger import logger


class DatabaseSettings(BaseModel):
    """Supabase PostgreSQL connection settings."""

    # Use the Direct Connection URL (port 5432) for asyncpg compatibility.
    # Transaction-mode pooler (port 6543) also works — statement_cache_size=0
    # is set unconditionally in core/database.py to handle both cases.
    url: str  # postgresql+asyncpg://user:pass@host:5432/postgres
    direct_url: str  # postgresql+asyncpg://user:pass@host:5432/postgres --- for alembic


class JwtSettings(BaseModel):
    """JSON Web Token settings."""

    secret: str
    algorithm: str = "HS256"
    expire_minutes: int = 1440  # 24 hours


class AISettings(BaseModel):
    """AI provider settings (OpenRouter)."""

    # Fallback when the user sends no X-OpenRouter-Key; unset means users must bring a key.
    api_key: str | None = None
    base_url: str = "https://openrouter.ai/api/v1"
    model: str = "openai/gpt-oss-120b:free"


class Settings(BaseSettings):
    """Top-level application settings."""

    project_name: str = "reqlens"
    debug: bool = False
    cors_origins: list[str] = ["*"]

    database: DatabaseSettings
    jwt: JwtSettings
    ai: AISettings = AISettings()

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        nested_model_default_partial_update=True,
    )


try:
    settings = Settings()  # type: ignore[call-arg]
except ValidationError as e:
    logger.error("Configuration error — missing or invalid environment variables")
    for err in e.errors():
        field_path = "__".join(str(loc).upper() for loc in err["loc"])
        logger.error("Invalid field", field=field_path, message=err["msg"])
