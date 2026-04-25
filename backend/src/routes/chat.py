import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from core.logger import logger
from deps import CurrentUser, DBSession
from models.chat import Chat
from models.user import User
from schemas.chat import ChatCreate, ChatListItem, ChatOut, JoinResponse

router = APIRouter()


async def _load_chat(chat_id: uuid.UUID, session: DBSession) -> Chat | None:
    result = await session.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(selectinload(Chat.developers), selectinload(Chat.clients))
    )
    return result.scalar_one_or_none()


@router.get(
    "", response_model=list[ChatListItem], summary="List all chats I participate in"
)
async def list_chats(current_user: CurrentUser, session: DBSession) -> list[ChatListItem]:
    result = await session.execute(
        select(Chat)
        .where(
            or_(
                Chat.developers.any(User.id == current_user.id),
                Chat.clients.any(User.id == current_user.id),
            )
        )
        .options(selectinload(Chat.developers), selectinload(Chat.clients))
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
    chat = Chat(title=payload.title)
    chat.developers.append(current_user)
    session.add(chat)
    await session.commit()

    chat = await _load_chat(chat.id, session)  # type: ignore[assignment]
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
    summary="Join an existing chat as a client via invite code",
)
async def join_chat(
    invite_code: str,
    current_user: CurrentUser,
    session: DBSession,
) -> JoinResponse:
    result = await session.execute(
        select(Chat)
        .where(Chat.invite_code == invite_code)
        .options(selectinload(Chat.developers), selectinload(Chat.clients))
    )
    chat = result.scalar_one_or_none()

    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )

    developer_ids = {u.id for u in chat.developers}
    client_ids = {u.id for u in chat.clients}

    if current_user.id in developer_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot join a chat you are a developer of",
        )
    if current_user.id in client_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a member of this chat",
        )

    chat.clients.append(current_user)
    await session.commit()

    chat = await _load_chat(chat.id, session)  # type: ignore[assignment]
    logger.info("User joined chat", chat_id=str(chat.id), user_id=str(current_user.id))
    return JoinResponse(chat=ChatOut.model_validate(chat))
