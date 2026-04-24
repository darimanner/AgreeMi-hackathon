import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from core.logger import logger
from deps import CurrentUser, DBSession
from models.chat import Chat
from schemas.chat import ChatCreate, ChatListItem, ChatOut, JoinResponse

router = APIRouter()


@router.get(
    "",
    response_model=list[ChatListItem],
    summary="List all chats I participate in",
)
async def list_chats(current_user: CurrentUser, session: DBSession) -> list[ChatListItem]:
    """Return all chat rooms where the current user is developer or client.

    Args:
        current_user: Authenticated user from JWT.
        session: Async database session.

    Returns:
        List of chat summaries.
    """
    result = await session.execute(
        select(Chat)
        .where(
            or_(
                Chat.developer_id == current_user.id,
                Chat.client_id == current_user.id,
            )
        )
        .order_by(Chat.created_at.desc())
    )
    chats = result.scalars().all()
    return [ChatListItem.model_validate(c) for c in chats]


@router.post(
    "",
    response_model=ChatOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new chat room",
)
async def create_chat(
    payload: ChatCreate,
    current_user: CurrentUser,
    session: DBSession,
) -> ChatOut:
    """Create a chat room owned by the current user as developer.

    Args:
        payload: Optional title.
        current_user: Authenticated user.
        session: Async database session.

    Returns:
        Created chat room with invite_code.
    """
    chat = Chat(developer_id=current_user.id, title=payload.title)
    session.add(chat)
    await session.commit()
    await session.refresh(chat)

    logger.info(
        "Chat created",
        chat_id=str(chat.id),
        invite_code=chat.invite_code,
        owner=str(current_user.id),
    )
    return ChatOut.model_validate(chat)


@router.post(
    "/join/{invite_code}",
    response_model=JoinResponse,
    summary="Join an existing chat via invite code",
)
async def join_chat(
    invite_code: str,
    current_user: CurrentUser,
    session: DBSession,
) -> JoinResponse:
    """Associate the current user as the client of the chat identified by *invite_code*.

    Args:
        invite_code: URL-safe string from the chat's invite link.
        current_user: Authenticated user.
        session: Async database session.

    Returns:
        JoinResponse with the updated chat.

    Raises:
        HTTPException: 404 if no matching chat exists.
        HTTPException: 409 if the chat already has a client or user is the developer.
    """
    result = await session.execute(select(Chat).where(Chat.invite_code == invite_code))
    chat = result.scalar_one_or_none()

    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )

    if chat.developer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot join a chat you created",
        )
    if chat.client_id is not None and chat.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chat already has a client",
        )

    chat.client_id = current_user.id
    await session.commit()
    await session.refresh(chat)

    logger.info("User joined chat", chat_id=str(chat.id), user_id=str(current_user.id))
    return JoinResponse(chat=ChatOut.model_validate(chat))


async def _get_chat_or_404(chat_id: uuid.UUID, session: DBSession) -> Chat:
    """Fetch a Chat by ID or raise 404.

    Args:
        chat_id: UUID of the chat to fetch.
        session: Async database session.

    Returns:
        Chat ORM instance.

    Raises:
        HTTPException: 404 if not found.
    """
    result = await session.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return chat
