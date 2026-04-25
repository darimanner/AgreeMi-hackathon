import io
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from markitdown import MarkItDown
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.logger import logger
from core.ws_manager import manager
from deps import CurrentUser, DBSession
from models.chat import Chat
from models.file import Attachment
from models.message import Message, MessageRole
from models.user import UserRole
from schemas.message import MessageOut

router = APIRouter()

_md = MarkItDown()


def _role_for_user(user_role: UserRole) -> MessageRole:
    """Map a UserRole to the corresponding MessageRole.

    Args:
        user_role: Role assigned to the authenticated user.

    Returns:
        MessageRole matching the user's platform role.
    """
    return MessageRole.CLIENT if user_role == UserRole.CLIENT else MessageRole.DEVELOPER


async def _assert_participant(
    chat_id: uuid.UUID, user_id: uuid.UUID, session: DBSession
) -> Chat:
    result = await session.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(selectinload(Chat.developers), selectinload(Chat.clients))
    )
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    member_ids = {u.id for u in chat.developers} | {u.id for u in chat.clients}
    if user_id not in member_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat"
        )
    return chat


@router.get(
    "/{chat_id}/messages",
    response_model=list[MessageOut],
    summary="Fetch message history for a chat",
)
async def get_messages(
    chat_id: uuid.UUID,
    current_user: CurrentUser,
    session: DBSession,
    limit: int = 50,
    offset: int = 0,
) -> list[MessageOut]:
    """Return paginated messages for *chat_id* ordered chronologically.

    Args:
        chat_id: UUID of the target chat.
        current_user: Authenticated user.
        session: Async database session.
        limit: Maximum number of messages to return (default 50).
        offset: Number of messages to skip for pagination.

    Returns:
        List of MessageOut objects.
    """
    await _assert_participant(chat_id, current_user.id, session)

    result = await session.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .options(selectinload(Message.attachments))
        .order_by(Message.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    messages = result.scalars().all()
    return [MessageOut.model_validate(m) for m in messages]


@router.post(
    "/{chat_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message (with optional file attachment)",
)
async def send_message(
    chat_id: uuid.UUID,
    current_user: CurrentUser,
    session: DBSession,
    content: str = Form(..., min_length=1),
    file: UploadFile | None = File(None),
) -> MessageOut:
    """Persist a message and broadcast it to all WebSocket participants.

    If *file* is provided, its text content is extracted via markitdown and
    stored as an Attachment linked to the message.

    Args:
        chat_id: UUID of the target chat.
        current_user: Authenticated user.
        session: Async database session.
        content: Message text body (form field).
        file: Optional file upload (form field).

    Returns:
        The created MessageOut.
    """
    await _assert_participant(chat_id, current_user.id, session)

    role = _role_for_user(current_user.role)

    message = Message(
        chat_id=chat_id,
        author_id=current_user.id,
        role=role,
        content=content,
    )
    session.add(message)
    await session.flush()  # populate message.id before creating attachment

    attachment: Attachment | None = None
    if file and file.filename:
        raw = await file.read()
        markdown_content = ""
        try:
            result_md = _md.convert_stream(io.BytesIO(raw), file_extension="")
            markdown_content = result_md.text_content or ""
        except Exception as exc:
            logger.warning(
                "Could not extract text from file",
                filename=file.filename,
                error=str(exc),
            )

        attachment = Attachment(
            chat_id=chat_id,
            message_id=message.id,
            uploaded_by_id=current_user.id,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            markdown_content=markdown_content,
        )
        session.add(attachment)

    await session.commit()

    # Reload with attachments for the response.
    await session.refresh(message)
    result_q = await session.execute(
        select(Message)
        .where(Message.id == message.id)
        .options(selectinload(Message.attachments))
    )
    message = result_q.scalar_one()

    msg_out = MessageOut.model_validate(message)
    await manager.broadcast(chat_id, msg_out.model_dump(mode="json"))

    logger.info(
        "Message sent",
        chat_id=str(chat_id),
        message_id=str(message.id),
        role=role,
        has_file=attachment is not None,
    )
    return msg_out
