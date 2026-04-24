import logging
from typing import Any

import structlog
from structlog.dev import ConsoleRenderer
from structlog.processors import (
    JSONRenderer,
    StackInfoRenderer,
    TimeStamper,
    add_log_level,
)
from structlog.types import Processor


class InterceptHandler(logging.Handler):
    """Route stdlib logging records into structlog."""

    def emit(self, record: logging.LogRecord) -> None:
        # Map stdlib level name → structlog bound method (info, warning, error, …).
        level_name = record.levelname.lower()
        sl = structlog.get_logger(record.name)
        log_fn = getattr(sl, level_name, sl.info)
        log_fn(record.getMessage(), **record.__dict__.get("extra", {}))


def setup_logging(debug: bool = False) -> None:
    """
    Configures structlog for the application and intercepts standard logging.

    Args:
        debug: If True, uses ConsoleRenderer for pretty printing.
               If False, uses JSONRenderer for production logging.
    """
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        add_log_level,
        structlog.processors.UnicodeDecoder(),
        TimeStamper(fmt="iso"),
    ]

    if debug:
        # Development: Pretty print to console
        processors = shared_processors + [
            StackInfoRenderer(),
            ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.rich_traceback,
            ),
        ]
    else:
        # Production: JSON output
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if debug else logging.INFO
        ),
        cache_logger_on_first_use=True,
    )

    # Hijack standard logging
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Remove default handlers so logs flow only through InterceptHandler → structlog.
    for logger_name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "hypercorn",
        "hypercorn.error",
        "hypercorn.access",
        "alembic",
        "alembic.runtime",
        "alembic.runtime.migration",
        "sqlalchemy.engine",
    ):
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = []
        logging_logger.propagate = True


def get_logger(name: str | None = None) -> Any:  # noqa: ANN401
    """
    Returns a configured structlog logger.

    Args:
        name: Optional name for the logger.
    """
    return structlog.get_logger(name)


# Default logger instance for direct import
logger = get_logger()
