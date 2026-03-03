"""
Structured logging configuration.

Configures Python logging with JSON output (for production log aggregation)
or human-readable text (for development).  A FastAPI middleware is also
provided to inject a unique ``correlation_id`` into every request.
"""

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable so the correlation ID is available everywhere in a request
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    return _correlation_id.get()


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        import traceback

        data: dict = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "whatsapp-automation",
        }

        cid = _correlation_id.get()
        if cid:
            data["correlation_id"] = cid

        # Extra fields attached via ``extra={}``
        for key, val in record.__dict__.items():
            if key not in {
                "args", "asctime", "created", "exc_info", "exc_text",
                "filename", "funcName", "id", "levelname", "levelno",
                "lineno", "message", "module", "msecs", "msg", "name",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "thread", "threadName",
            }:
                data[key] = val

        if record.exc_info:
            data["exception"] = traceback.format_exception(*record.exc_info)

        return json.dumps(data, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Setup function — call once at application startup
# ---------------------------------------------------------------------------

def setup_logging(level: str = "INFO", fmt: str = "json") -> None:
    """Configure root logger.

    Args:
        level: Logging level string (``"DEBUG"``, ``"INFO"``, etc.)
        fmt:   ``"json"`` for production, ``"text"`` for development.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    if fmt == "json":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(numeric_level)

    # Quieten noisy third-party loggers
    for name in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# FastAPI middleware
# ---------------------------------------------------------------------------

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Inject a ``X-Correlation-ID`` header and set the context variable."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        cid = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = _correlation_id.set(cid)
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = cid
            return response
        finally:
            _correlation_id.reset(token)
