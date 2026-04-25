import json

from fastapi import HTTPException, status
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from config import settings
from core.logger import logger
from schemas.analysis import AnalysisResult

_client = AsyncOpenAI(
    api_key=settings.ai.api_key,
    base_url=settings.ai.base_url,
)

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_ANALYZE_SYSTEM_PROMPT = """\
You are a senior product analyst and technical reviewer.

Analyze the uploaded requirements document.

Return ONLY valid JSON with this shape:

{
  "document_markdown": string,
  "analysis_markdown": string,
  "score": number,
  "findings": [
    {
      "id": string,
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": string,
      "explanation": string,
      "recommendation": string,
      "quote": string,
      "start_line": number,
      "end_line": number
    }
  ]
}

Rules:
- document_markdown must be a clean markdown version of the source document.
- analysis_markdown must be a human-readable review with summary, risks, unrealistic parts, missing requirements, unclear acceptance criteria, technical concerns, and recommended next steps.
- findings must point to exact problematic fragments from document_markdown.
- quote must be copied from document_markdown.
- start_line and end_line must refer to line numbers in document_markdown.
- score must be 0-100, where 100 means clear, realistic, implementable requirements.
- Do not wrap JSON in markdown fences.
- CRITICAL: All string values must use \\n for line breaks, never literal newline characters. The output must be valid single-object JSON parseable by json.loads().
"""

_UPDATE_SYSTEM_PROMPT = """\
You are a project progress summarizer for a client-developer communication platform.
Given a list of recent chat messages, produce a concise 2-4 sentence summary
describing the current project status and any key decisions or blockers mentioned.
Be factual, neutral, and developer-friendly.
"""


# ---------------------------------------------------------------------------
# JSON sanitizer
# ---------------------------------------------------------------------------


def _escape_control_char(char: str) -> str:
    if char == "\n":
        return "\\n"
    if char == "\r":
        return "\\r"
    if char == "\t":
        return "\\t"
    return f"\\u{ord(char):04x}"


def _sanitize_json(raw: str) -> str:
    """Escape unescaped control characters inside JSON string literals.

    LLMs sometimes output literal newlines/tabs inside JSON strings instead
    of the required \\n / \\t escapes, which makes json.loads() fail with
    'Invalid control character'. This function fixes that by scanning the
    raw string character by character and escaping any bare control char
    found inside a JSON string value.
    """
    result: list[str] = []
    in_string = False
    escape_next = False

    for char in raw:
        if escape_next:
            result.append(char)
            escape_next = False
            continue
        if char == "\\" and in_string:
            result.append(char)
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
            result.append(char)
            continue
        if in_string and ord(char) < 0x20:
            result.append(_escape_control_char(char))
        else:
            result.append(char)

    return "".join(result)


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
            max_tokens=6000,
        )
    except Exception as exc:
        _raise_for_ai_error(exc)

    raw = response.choices[0].message.content or "{}"
    logger.debug(
        "Received AI analysis response",
        tokens_used=response.usage and response.usage.total_tokens,
    )

    sanitized = _sanitize_json(raw)
    try:
        data = json.loads(sanitized)
        return AnalysisResult.model_validate(data)
    except Exception as exc:
        logger.error(
            "Failed to parse AI analysis response", raw=raw[:500], error=str(exc)
        )
        raise ValueError(f"Model returned unparseable JSON: {exc}") from exc


async def summarize_messages(messages: list[str]) -> str:
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
