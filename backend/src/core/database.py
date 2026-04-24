from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings

# statement_cache_size=0 disables asyncpg's prepared statement cache.
# Required when using Supabase's Transaction-mode pooler (port 6543).
# Safe and harmless when using a Direct Connection (port 5432).
engine = create_async_engine(
    settings.database.url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency that yields a database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
