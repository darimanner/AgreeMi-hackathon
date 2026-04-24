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
    """
    Default handler from standard logging to intercept and redirect to structlog.
    """

    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding structlog logger
        try:
            level = structlog.get_logger(record.name)._proxy_to.log_level
        except AttributeError:
            level = logging.INFO

        if record.levelno >= level:
            structlog.get_logger(record.name).log(
                record.levelno,
                record.getMessage(),
                **record.__dict__.get("extra", {}),
            )


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

    # Disable default handlers for common web servers
    for logger_name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "hypercorn",
        "hypercorn.error",
        "hypercorn.access",
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
