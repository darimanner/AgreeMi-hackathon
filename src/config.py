import sys

from pydantic import BaseModel, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.logger import logger


class APITokens(BaseModel):
    """External API Tokens"""

    openrouter: str


class Settings(BaseSettings):
    """Application settings."""

    project_name: str = "prism-2026"
    debug: bool = False

    api_tokens: APITokens

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        nested_model_default_partial_update=True,
    )


# Initialize settings and validate
try:
    settings = Settings()  # type: ignore
except ValidationError as e:
    logger.error("Configuration Error. Missing or invalid environment variables:")
    for err in e.errors():
        field_path = "__".join(str(loc).upper() for loc in err["loc"])
        logger.error("Invalid field", field=field_path, message=err["msg"])
    sys.exit(1)
