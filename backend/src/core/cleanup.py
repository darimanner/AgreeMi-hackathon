from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, exists, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from models.chat import Chat, chat_clients, chat_developers
from models.message import Message
from models.user import User

# Keeps the free Neon database small: a public demo collects throwaway accounts and documents.
RETENTION = timedelta(days=14)
# Accounts of the live demo: they and their chats are never deleted.
DEMO_EMAILS = ("alex.morgan.dev@example.com", "olivia.bennett.client@example.com")


async def delete_stale_data(session: AsyncSession) -> None:
    """Delete chats idle for RETENTION and accounts older than RETENTION that are in no chat."""
    cutoff = datetime.now(UTC) - RETENTION
    # Fail fast on a lock held by the old instance during a deploy: startup has hypercorn's 60 s limit.
    await session.execute(text("SET LOCAL lock_timeout = '5s'"))
    await session.execute(text("SET LOCAL statement_timeout = '20s'"))
    demo_users = select(User.id).where(User.email.in_(DEMO_EMAILS))
    has_demo_member = or_(
        exists().where(
            chat_developers.c.chat_id == Chat.id,
            chat_developers.c.user_id.in_(demo_users),
        ),
        exists().where(
            chat_clients.c.chat_id == Chat.id, chat_clients.c.user_id.in_(demo_users)
        ),
    )
    # Messages, attachments, analysis versions and memberships go with the chat (ON DELETE CASCADE).
    chats = await session.execute(
        delete(Chat)
        .where(
            Chat.updated_at < cutoff,
            ~exists().where(Message.chat_id == Chat.id, Message.created_at >= cutoff),
            ~has_demo_member,
        )
        .execution_options(synchronize_session=False)
    )
    users = await session.execute(
        delete(User)
        .where(
            User.created_at < cutoff,
            User.email.not_in(DEMO_EMAILS),
            ~exists().where(chat_developers.c.user_id == User.id),
            ~exists().where(chat_clients.c.user_id == User.id),
        )
        .execution_options(synchronize_session=False)
    )
    await session.commit()
    logger.info("Stale data deleted", chats=chats.rowcount, users=users.rowcount)
