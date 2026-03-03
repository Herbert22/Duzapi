"""
Synchronous and asynchronous Redis clients.

Used for:
- Message deduplication (webhook idempotency)
- Session metadata caching
- Rate limiting (future)
"""

import logging
from typing import Optional

import redis as _sync_redis
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sync Redis client (used by Celery tasks and webhook deduplication)
# ---------------------------------------------------------------------------

_sync_client: Optional[_sync_redis.Redis] = None


def get_redis() -> _sync_redis.Redis:
    """Return a shared synchronous Redis client (lazy init)."""
    global _sync_client
    if _sync_client is None:
        _sync_client = _sync_redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
    return _sync_client


def is_duplicate(key: str, ttl_seconds: int = 300) -> bool:
    """Return True if ``key`` was seen within ``ttl_seconds``.

    Uses SET NX (atomic) to prevent race conditions.
    Used for webhook deduplication: key = ``dedup:<whatsapp_message_id>``
    """
    try:
        client = get_redis()
        result = client.set(key, "1", nx=True, ex=ttl_seconds)
        return result is None  # None means key already existed
    except Exception as exc:
        logger.warning("Redis dedup check failed, allowing through", extra={"error": str(exc)})
        return False  # fail open — do not drop messages if Redis is unavailable
