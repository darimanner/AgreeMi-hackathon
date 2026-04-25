import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, select

from clients.openai_client import summarize_analysis
from core.logger import logger
from deps import CurrentUser, DBSession
from models.analysis_version import AnalysisVersion
from models.chat import Chat, chat_clients, chat_developers
from schemas.analysis import AnalysisResult, AnalysisSummaryResponse

router = APIRouter()


async def _assert_participant(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    session: DBSession,
) -> None:
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


@router.post(
    "/{chat_id}/analysis/summary",
    response_model=AnalysisSummaryResponse,
    summary="Generate an executive summary of the latest analysis",
    responses={
        404: {
            "description": "Chat not found or no analysis exists yet — run /analyze first"
        },
        502: {"description": "AI service error or empty response"},
        429: {"description": "AI service rate limit exceeded"},
        503: {"description": "AI service unreachable"},
        504: {"description": "AI service timed out"},
    },
)
async def generate_analysis_summary(
    chat_id: uuid.UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> AnalysisSummaryResponse:
    """Generate a concise executive summary of the most recent analysis version.

    Fetches the latest ``AnalysisVersion`` by ``version_number`` — always
    fresh, never a stale cache. Passes the score, review, and findings to
    the AI and returns a 3-5 sentence plain-language summary suitable for
    both developers and non-technical stakeholders.

    Returns ``summary``, ``version`` number, and ``score`` of the analysed version.
    """
    await _assert_participant(chat_id, current_user.id, session)

    row = await session.execute(
        select(AnalysisVersion)
        .where(AnalysisVersion.chat_id == chat_id)
        .order_by(AnalysisVersion.version_number.desc())
        .limit(1)
    )
    latest = row.scalar_one_or_none()
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis found for this chat — run /analyze first",
        )

    analysis = AnalysisResult.model_validate(latest.analysis_json)

    try:
        return await summarize_analysis(analysis, latest.version_number)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Analysis summary generation failed",
            chat_id=str(chat_id),
            version=latest.version_number,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI summary generation failed",
        ) from exc
