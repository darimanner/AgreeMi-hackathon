import json

from fastapi import HTTPException, status
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from config import settings
from core.logger import logger
from schemas.analysis import AnalysisResult

# The AsyncOpenAI SDK is fully compatible with OpenRouter's API surface.
_client = AsyncOpenAI(
    api_key=settings.ai.api_key,
    base_url=settings.ai.base_url,
)

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_ANALYZE_SYSTEM_PROMPT = """\
You are a senior software requirements analyst.
Analyze the provided document and return a JSON object with EXACTLY this shape:
{
  "score": <integer 0-100 representing overall requirements quality>,
  "summary": "<concise 2-3 sentence summary of the document>",
  "issues": [
    {
      "id": "ISSUE-1",
      "severity": "<high|medium|low>",
      "title": "<short issue title>",
      "description": "<detailed description of the problem>",
      "suggestion": "<actionable improvement suggestion>"
    }
  ]
}
Return ONLY the JSON object. No markdown fences, no explanation outside the JSON.
"""

_UPDATE_SYSTEM_PROMPT = """\
You are a project progress summarizer for a client-developer communication platform.
Given a list of recent chat messages, produce a concise 2-4 sentence summary
describing the current project status and any key decisions or blockers mentioned.
Be factual, neutral, and developer-friendly.
"""


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


def _raise_for_ai_error(exc: Exception) -> None:
    """Map OpenAI / OpenRouter SDK errors to FastAPI HTTPExceptions."""
    if isinstance(exc, APIStatusError):
        code = exc.status_code
        if code == 401:
            logger.error(
                "OpenRouter authentication failed — check AI_API_KEY", status=code
            )
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                detail="AI service authentication error (invalid API key)",
            )
        if code == 429:
            logger.warning("OpenRouter rate limit hit")
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI service rate limit exceeded — retry later",
            )
        if code == 422:
            logger.error("OpenRouter rejected the request", status=code, body=str(exc))
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                detail="AI service rejected the request (invalid input)",
            )
        if code >= 500:
            logger.error("OpenRouter server error", status=code)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service temporarily unavailable",
            )
        logger.error("OpenRouter API error", status=code, error=str(exc))
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error (status {code})",
        )

    if isinstance(exc, APITimeoutError):
        logger.error("OpenRouter request timed out")
        raise HTTPException(
            status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service timed out",
        )

    if isinstance(exc, APIConnectionError):
        logger.error("OpenRouter unreachable", error=str(exc))
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unreachable",
        )

    logger.error("Unexpected AI client error", error=str(exc))
    raise HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        detail="AI request failed",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def analyze_document(text: str) -> AnalysisResult:
    """Analyze *text* and return a structured AnalysisResult.

    Args:
        text: Extracted plain text / markdown from the uploaded document.

    Returns:
        Validated AnalysisResult pydantic model.

    Raises:
        ValueError: If the model returns malformed JSON.
        openai.OpenAIError: On API failure.
    """
    logger.info(
        "Sending document for AI analysis",
        model=settings.ai.model,
        chars=len(text),
    )

    try:
        response = await _client.chat.completions.create(
            model=settings.ai.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _ANALYZE_SYSTEM_PROMPT},
                {"role": "user", "content": text[:12_000]},
            ],
            temperature=0.2,
        )
    except Exception as exc:
        _raise_for_ai_error(exc)

    raw = response.choices[0].message.content or "{}"
    logger.debug(
        "Received AI analysis response",
        tokens_used=response.usage and response.usage.total_tokens,
    )

    try:
        data = json.loads(raw)
        return AnalysisResult.model_validate(data)
    except Exception as exc:
        logger.error("Failed to parse AI analysis response", raw=raw[:500])
        raise ValueError(f"Model returned unparseable JSON: {exc}") from exc


async def summarize_messages(messages: list[str]) -> str:
    """Summarize *messages* into a short project progress update.

    Args:
        messages: Recent message content strings (chronological order).

    Returns:
        Plain-text summary paragraph.

    Raises:
        openai.OpenAIError: On API failure.
    """
    transcript = "\n".join(f"- {m}" for m in messages)
    logger.info(
        "Summarizing messages for /update", count=len(messages), model=settings.ai.model
    )

    try:
        response = await _client.chat.completions.create(
            model=settings.ai.model,
            messages=[
                {"role": "system", "content": _UPDATE_SYSTEM_PROMPT},
                {"role": "user", "content": transcript},
            ],
            temperature=0.3,
            max_tokens=300,
        )
    except Exception as exc:
        _raise_for_ai_error(exc)

    return response.choices[0].message.content or "No summary available."
