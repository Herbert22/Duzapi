import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from motor.motor_asyncio import AsyncIOMotorClient
from typing import AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PostgreSQL (async)
# ---------------------------------------------------------------------------

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# PostgreSQL (sync) — used by Celery workers
# ---------------------------------------------------------------------------

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


def get_sync_db() -> Session:
    """Return a synchronous DB session (Celery tasks)."""
    return SyncSessionLocal()


# ---------------------------------------------------------------------------
# MongoDB (async)
# ---------------------------------------------------------------------------

class MongoDB:
    client: AsyncIOMotorClient = None
    database = None


mongodb = MongoDB()


async def connect_mongodb():
    """Connect to MongoDB and ensure required indexes exist."""
    mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
    mongodb.database = mongodb.client[settings.MONGODB_DB]
    logger.info("MongoDB connection established", extra={"db": settings.MONGODB_DB})
    await _ensure_mongodb_indexes(mongodb.database)


async def _ensure_mongodb_indexes(db) -> None:
    """Create required indexes on the message_logs collection."""
    from pymongo import ASCENDING, DESCENDING
    col = db["message_logs"]

    # Compound index for fast conversation history queries
    await col.create_index(
        [("tenant_id", ASCENDING), ("session_id", ASCENDING), ("processed_at", DESCENDING)],
        name="tenant_session_time",
        background=True,
    )
    # Index for deduplication by external WhatsApp message ID
    await col.create_index(
        [("message_id", ASCENDING)],
        name="message_id",
        sparse=True,
        background=True,
    )
    # TTL index — documents expire after MESSAGE_LOG_TTL_DAYS days
    await col.create_index(
        [("processed_at", ASCENDING)],
        name="ttl_processed_at",
        expireAfterSeconds=settings.MESSAGE_LOG_TTL_DAYS * 86400,
        background=True,
    )
    logger.info("MongoDB indexes verified", extra={"collection": "message_logs"})

    # Funnel session state indexes
    fs_col = db["funnel_sessions"]
    await fs_col.create_index(
        [("tenant_id", ASCENDING), ("session_id", ASCENDING)],
        name="tenant_session_funnel",
        unique=True,
        background=True,
    )
    await fs_col.create_index(
        [("wait_until", ASCENDING)],
        name="wait_until",
        sparse=True,
        background=True,
    )
    logger.info("MongoDB indexes verified", extra={"collection": "funnel_sessions"})


async def close_mongodb():
    """Close MongoDB connection."""
    if mongodb.client:
        mongodb.client.close()
        logger.info("MongoDB connection closed")


def get_mongodb():
    """Return the MongoDB database instance."""
    return mongodb.database
