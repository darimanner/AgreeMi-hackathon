import io
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from markitdown import MarkItDown
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from core.logger import logger
from core.ws_manager import manager
from deps import CurrentUser, DBSession
from models.chat import Chat, chat_clients, chat_developers
from models.file import Attachment
from models.message import Message, MessageRole
from models.user import UserRole
from schemas.message import MessageOut

router = APIRouter()

_md = MarkItDown()


def _role_for_user(user_role: UserRole) -> MessageRole:
    return MessageRole.CLIENT if user_role == UserRole.CLIENT else MessageRole.DEVELOPER


async def _assert_participant(
    chat_id: uuid.UUID, user_id: uuid.UUID, session: DBSession
) -> None:
    """Check participation in 1 DB round trip via LEFT JOIN instead of selectinload."""
    result = await session.execute(
        select(
            Chat.id,
            chat_developers.c.user_id.label("dev_uid"),
            chat_clients.c.user_id.label("cli_uid"),
        )
        .outerjoin(
            chat_developers,
            and_(
                chat_developers.c.chat_id == Chat.id, chat_developers.c.user_id == user_id
            ),
        )
        .outerjoin(
            chat_clients,
            and_(chat_clients.c.chat_id == Chat.id, chat_clients.c.user_id == user_id),
        )
        .where(Chat.id == chat_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    if row.dev_uid is None and row.cli_uid is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat"
        )


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
    await _assert_participant(chat_id, current_user.id, session)

    role = _role_for_user(current_user.role)
    message = Message(
        chat_id=chat_id,
        author_id=current_user.id,
        role=role,
        content=content,
    )
    session.add(message)

    attachment: Attachment | None = None
    if file and file.filename:
        # flush to get message.id before creating the attachment FK
        await session.flush()

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

    # Set relationship in memory so model_validate works without a re-query.
    # expire_on_commit=False keeps all attributes alive after commit.
    message.attachments = [attachment] if attachment else []

    await session.commit()

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
