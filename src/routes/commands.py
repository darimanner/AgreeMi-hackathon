import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from clients.openai_client import analyze_document, summarize_messages
from core.logger import logger
from core.ws_manager import manager
from deps import CurrentUser, DBSession
from models.chat import Chat
from models.file import Attachment
from models.message import Message, MessageRole
from schemas.message import CommandName, CommandRequest, CommandResponse, MessageOut

router = APIRouter()


async def _get_participant_chat(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    session: DBSession,
) -> Chat:
    """Return the Chat if the user is a participant, else raise.

    Args:
        chat_id: UUID of the target chat.
        user_id: Authenticated user UUID.
        session: Async database session.

    Returns:
        Chat ORM instance.

    Raises:
        HTTPException: 404/403 as appropriate.
    """
    result = await session.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    if chat.developer_id != user_id and chat.client_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant of this chat",
        )
    return chat


async def _save_and_broadcast(
    chat_id: uuid.UUID,
    role: MessageRole,
    content: str,
    session: DBSession,
) -> Message:
    """Persist an AI/system message and broadcast to WebSocket clients.

    Args:
        chat_id: Target chat UUID.
        role: MessageRole (ai or system).
        content: Message body text.
        session: Async database session.

    Returns:
        Saved Message ORM instance.
    """
    async with session.begin():
        msg = Message(
            chat_id=chat_id,
            author_id=None,  # machine-generated
            role=role,
            content=content,
        )
        session.add(msg)

    await session.refresh(msg)

    result = await session.execute(
        select(Message)
        .where(Message.id == msg.id)
        .options(selectinload(Message.attachments))
    )
    msg = result.scalar_one()
    msg_out = MessageOut.model_validate(msg)
    await manager.broadcast(chat_id, msg_out.model_dump(mode="json"))
    return msg


@router.post(
    "/{chat_id}/commands",
    response_model=CommandResponse,
    summary="Execute a slash command in a chat",
)
async def run_command(
    chat_id: uuid.UUID,
    payload: CommandRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> CommandResponse:
    """Execute */update* or */analyze* in the specified chat.

    - **/update**: Summarises the last 20 messages and saves a ``system`` message.
    - **/analyze**: Processes the most recent attachment in the chat through GPT-4o,
      stores the structured result in ``chat.ai_analysis_json``, and saves an ``ai`` message.

    Args:
        chat_id: UUID of the target chat.
        payload: Command name.
        current_user: Authenticated user.
        session: Async database session.

    Returns:
        CommandResponse with the AI-generated text and the saved message.
    """
    await _get_participant_chat(chat_id, current_user.id, session)

    if payload.command == CommandName.UPDATE:
        result = await session.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.created_at.desc())
            .limit(20)
        )
        recent = result.scalars().all()
        if not recent:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No messages to summarize",
            )

        # Reverse to chronological order for the summarizer.
        texts = [m.content for m in reversed(recent)]
        try:
            summary = await summarize_messages(texts)
        except Exception as exc:
            logger.error("/update AI call failed", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="AI request failed"
            ) from exc

        msg = await _save_and_broadcast(chat_id, MessageRole.SYSTEM, summary, session)
        return CommandResponse(
            command=payload.command,
            result=summary,
            message=MessageOut.model_validate(msg),
        )

    # CommandName.ANALYZE
    att_result = await session.execute(
        select(Attachment)
        .where(Attachment.chat_id == chat_id)
        .order_by(Attachment.created_at.desc())
        .limit(1)
    )
    attachment = att_result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No attachments found in this chat",
        )
    if not attachment.markdown_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Latest attachment has no extractable text",
        )

    try:
        analysis = await analyze_document(attachment.markdown_content)
    except Exception as exc:
        logger.error(
            "/analyze AI call failed", attachment_id=str(attachment.id), error=str(exc)
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI analysis failed"
        ) from exc

    # Persist structured result on the Chat row.
    chat_result = await session.execute(select(Chat).where(Chat.id == chat_id))
    chat = chat_result.scalar_one()
    chat.ai_analysis_json = analysis.model_dump()
    # Also record raw analysis text on the attachment for traceability.
    attachment.ai_analysis = analysis.summary
    attachment.model_used = "gpt-4o"
    await session.commit()

    result_text = (
        f"**Analysis complete** (score: {analysis.score}/100)\n\n"
        f"{analysis.summary}\n\n"
        + (
            "\n".join(
                f"- [{i.severity.upper()}] **{i.title}**: {i.suggestion}"
                for i in analysis.issues
            )
            if analysis.issues
            else "_No issues identified._"
        )
    )

    msg = await _save_and_broadcast(chat_id, MessageRole.AI, result_text, session)

    logger.info(
        "/analyze complete",
        chat_id=str(chat_id),
        score=analysis.score,
        issues=len(analysis.issues),
    )
    return CommandResponse(
        command=payload.command,
        result=result_text,
        message=MessageOut.model_validate(msg),
    )
