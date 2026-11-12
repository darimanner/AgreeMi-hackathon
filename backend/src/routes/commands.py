import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from clients.openai_client import analyze_document, diff_analyses, summarize_messages
from config import settings
from core.logger import logger
from core.ws_manager import manager
from deps import CurrentUser, DBSession, OpenRouterKey
from models.analysis_version import AnalysisVersion
from models.chat import Chat, chat_clients, chat_developers
from models.file import Attachment
from models.message import Message, MessageRole
from schemas.analysis import AnalysisResult
from schemas.message import CommandName, CommandRequest, CommandResponse, MessageOut

router = APIRouter()


async def _get_participant_chat(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    session: DBSession,
) -> Chat:
    """Fetch Chat and verify membership in 1 DB round trip via LEFT JOIN."""
    result = await session.execute(
        select(
            Chat,
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
    chat, dev_uid, cli_uid = row
    if dev_uid is None and cli_uid is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat"
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
    msg = Message(
        chat_id=chat_id,
        author_id=None,  # machine-generated
        role=role,
        content=content,
    )
    session.add(msg)
    await session.commit()

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
    responses={
        422: {
            "description": "No messages / attachments / versions available for the command"
        },
        429: {"description": "AI service rate limit exceeded"},
        502: {"description": "AI service error"},
        503: {"description": "AI service unreachable"},
        504: {"description": "AI service timed out"},
    },
)
async def run_command(
    chat_id: uuid.UUID,
    payload: CommandRequest,
    current_user: CurrentUser,
    session: DBSession,
    openrouter_key: OpenRouterKey = None,
) -> CommandResponse:
    """Execute a slash command in the specified chat.

    Supported commands:

    - **/update** — Summarises the 20 most recent messages and saves a `system` message.
    - **/analyze** — Analyses the most recent file attachment with AI. Saves an `ai` message,
      updates `Chat.ai_analysis_json`, and creates a new `AnalysisVersion` snapshot.
      Response includes the full structured `analysis` object.
    - **/diff** — Semantically compares the two most recent `AnalysisVersion` snapshots.
      Saves an `ai` message. Response includes `diff` with `score_delta` and per-finding changes.
      Requires at least 2 prior `/analyze` calls.

    All commands require the caller to be a participant (developer or client) of the chat.
    """
    chat = await _get_participant_chat(chat_id, current_user.id, session)

    if payload.command == CommandName.UPDATE:
        return await _run_update(chat_id, payload.command, session, openrouter_key)

    if payload.command == CommandName.DIFF:
        return await _run_diff(chat_id, payload.command, session, openrouter_key)

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
        analysis = await analyze_document(attachment.markdown_content, openrouter_key)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "/analyze AI call failed", attachment_id=str(attachment.id), error=str(exc)
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI analysis failed"
        ) from exc

    version_count = await session.scalar(
        select(func.count()).where(AnalysisVersion.chat_id == chat_id)
    )
    chat.ai_analysis_json = analysis.model_dump()
    attachment.ai_analysis = analysis.analysis_markdown
    attachment.model_used = settings.ai.model
    session.add(
        AnalysisVersion(
            chat_id=chat_id,
            attachment_id=attachment.id,
            version_number=(version_count or 0) + 1,
            analysis_json=analysis.model_dump(),
        )
    )
    await session.commit()

    result_text = (
        f"**Analysis complete** (score: {analysis.score}/100)\n\n"
        f"{analysis.analysis_markdown}\n\n"
        + (
            "\n".join(
                f"- [{i.severity.upper()}] **{i.title}**: {i.recommendation}"
                for i in analysis.findings
            )
            if analysis.findings
            else "_No findings identified._"
        )
    )

    msg = await _save_and_broadcast(chat_id, MessageRole.AI, result_text, session)

    logger.info(
        "/analyze complete",
        chat_id=str(chat_id),
        score=analysis.score,
        findings=len(analysis.findings),
    )
    return CommandResponse(
        command=payload.command,
        result=result_text,
        message=MessageOut.model_validate(msg),
        analysis=analysis,
    )


async def _run_update(
    chat_id: uuid.UUID,
    command: CommandName,
    session: DBSession,
    openrouter_key: str | None,
) -> CommandResponse:
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
        summary = await summarize_messages(texts, openrouter_key)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("/update AI call failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI request failed"
        ) from exc

    msg = await _save_and_broadcast(chat_id, MessageRole.SYSTEM, summary, session)
    return CommandResponse(
        command=command,
        result=summary,
        message=MessageOut.model_validate(msg),
    )


async def _run_diff(
    chat_id: uuid.UUID,
    command: CommandName,
    session: DBSession,
    openrouter_key: str | None,
) -> CommandResponse:
    versions_result = await session.execute(
        select(AnalysisVersion)
        .where(AnalysisVersion.chat_id == chat_id)
        .order_by(AnalysisVersion.version_number.desc())
        .limit(2)
    )
    versions = versions_result.scalars().all()

    if len(versions) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Need at least 2 analysis versions to diff (found {len(versions)})",
        )

    v_new, v_old = versions[0], versions[1]
    a_old = AnalysisResult.model_validate(v_old.analysis_json)
    a_new = AnalysisResult.model_validate(v_new.analysis_json)

    try:
        diff = await diff_analyses(
            a_old, a_new, v_old.version_number, v_new.version_number, openrouter_key
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("/diff AI call failed", chat_id=str(chat_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI diff failed"
        ) from exc

    sign = "+" if diff.score_delta >= 0 else ""
    changes_text = (
        "\n".join(
            f"- [{c.change.upper()}] **{c.title}**"
            + (
                f" ({c.old_severity} → {c.new_severity})"
                if c.old_severity and c.new_severity
                else ""
            )
            + f": {c.explanation}"
            for c in diff.changes
        )
        or "_No significant changes detected._"
    )

    result_text = (
        f"**Diff v{v_old.version_number} → v{v_new.version_number}** "
        f"(score: {a_old.score} → {a_new.score}, {sign}{diff.score_delta})\n\n"
        f"{diff.summary}\n\n"
        f"{changes_text}"
    )

    msg = await _save_and_broadcast(chat_id, MessageRole.AI, result_text, session)

    logger.info(
        "/diff complete",
        chat_id=str(chat_id),
        old_version=v_old.version_number,
        new_version=v_new.version_number,
        score_delta=diff.score_delta,
        changes=len(diff.changes),
    )
    return CommandResponse(
        command=command,
        result=result_text,
        message=MessageOut.model_validate(msg),
        diff=diff,
    )
