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
- analysis_markdown must be a human-readable review with summary, risks, unrealistic parts, missing requirements, unclear acceptance criteria, technical concerns, and recommended next steps.
- findings must point to exact problematic fragments from the document.
- quote must be copied verbatim from the document.
- start_line and end_line refer to line numbers in the original document.
- score must be 0-100, where 100 means clear, realistic, implementable requirements.
- Do not wrap JSON in markdown fences.
- CRITICAL: All string values must use \\n for line breaks, never literal newline characters. The output must be valid single-object JSON parseable by json.loads().
"""

_FIX_SYSTEM_PROMPT = """\
The previous response contains malformed JSON that cannot be parsed.
Fix it and return ONLY a valid JSON object with this exact shape:

{
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

CRITICAL rules:
- All newlines inside string values must be written as \\n (escaped), never as literal line breaks.
- Do not wrap the result in markdown fences.
- Return ONLY the JSON object — no explanation, no preamble.
"""

_UPDATE_SYSTEM_PROMPT = """\
You are a project progress summarizer for a client-developer communication platform.
Given a list of recent chat messages, produce a concise 2-4 sentence summary
describing the current project status and any key decisions or blockers mentioned.
Be factual, neutral, and developer-friendly.
"""


# ---------------------------------------------------------------------------
# JSON sanitizer / extractor
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
    """Escape bare control characters inside JSON string literals."""
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


def _extract_json(raw: str) -> str:
    """Strip markdown fences / preamble and return the first complete JSON object."""
    raw = raw.strip()

    if raw.startswith("```"):
        newline = raw.find("\n")
        if newline != -1:
            raw = raw[newline + 1 :]
        raw = raw.rstrip("`").strip()

    start = raw.find("{")
    if start == -1:
        return raw

    depth = 0
    for i, char in enumerate(raw[start:], start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]

    return raw[start:]


def _parse_analysis(raw: str) -> tuple[AnalysisResult | None, str | None]:
    """Try to parse raw LLM output into AnalysisResult. Returns (result, error_detail)."""
    try:
        data = json.loads(_sanitize_json(_extract_json(raw)))
        return AnalysisResult.model_validate(data), None
    except Exception as exc:
        return None, str(exc)


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
        "Sending document for AI analysis", model=settings.ai.model, chars=len(text)
    )

    # --- Attempt 1: normal request ---
    try:
        response = await _client.chat.completions.create(
            model=settings.ai.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _ANALYZE_SYSTEM_PROMPT},
                {"role": "user", "content": text[:12_000]},
            ],
            temperature=0.2,
            max_tokens=50_000,
        )
    except Exception as exc:
        _raise_for_ai_error(exc)

    raw = response.choices[0].message.content or "{}"
    finish_reason = response.choices[0].finish_reason
    tokens_used = response.usage and response.usage.total_tokens

    logger.debug(
        "---\nAttempt 1 raw response\n---\n"
        + raw[:2000]
        + ("\n[...truncated]" if len(raw) > 2000 else "")
        + "\n---",
        tokens_used=tokens_used,
        finish_reason=finish_reason,
        raw_len=len(raw),
    )

    if finish_reason == "length":
        logger.warning(
            "Attempt 1 truncated by token limit",
            tokens_used=tokens_used,
            raw_len=len(raw),
        )

    result, parse_error = _parse_analysis(raw)
    if result:
        logger.info(
            "Attempt 1 succeeded", tokens_used=tokens_used, finish_reason=finish_reason
        )
        result.document_markdown = text
        return result

    # --- Attempt 2: send bad output back, ask model to fix it ---
    logger.warning(
        "---\nAttempt 1 failed — parse error\n---\n"
        + (parse_error or "unknown")
        + "\n---\nRaw preview:\n---\n"
        + raw[:500]
        + "\n---",
        finish_reason=finish_reason,
        tokens_used=tokens_used,
        raw_len=len(raw),
    )
    try:
        fix_response = await _client.chat.completions.create(
            model=settings.ai.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _FIX_SYSTEM_PROMPT},
                {"role": "user", "content": raw[:8_000]},
            ],
            temperature=0.0,
            max_tokens=50_000,
        )
    except Exception as exc:
        logger.error("Fix attempt API call failed", error=str(exc))
        _raise_for_ai_error(exc)

    fixed_raw = fix_response.choices[0].message.content or "{}"
    fix_finish_reason = fix_response.choices[0].finish_reason
    fix_tokens = fix_response.usage and fix_response.usage.total_tokens

    logger.debug(
        "---\nAttempt 2 (fix) raw response\n---\n"
        + fixed_raw[:2000]
        + ("\n[...truncated]" if len(fixed_raw) > 2000 else "")
        + "\n---",
        tokens_used=fix_tokens,
        finish_reason=fix_finish_reason,
    )

    if fix_finish_reason == "length":
        logger.warning(
            "Fix attempt also truncated by token limit", tokens_used=fix_tokens
        )

    result, fix_parse_error = _parse_analysis(fixed_raw)
    if result:
        logger.info("Attempt 2 (fix) succeeded", tokens_used=fix_tokens)
        result.document_markdown = text
        return result

    # --- Fallback: both attempts failed ---
    logger.error(
        "---\nBoth attempts failed\n---\n"
        "Attempt 1 error: " + (parse_error or "unknown") + "\n"
        "Attempt 2 error: " + (fix_parse_error or "unknown") + "\n---\n"
        "Attempt 2 raw tail:\n---\n" + fixed_raw[-500:] + "\n---",
    )
    return AnalysisResult(
        score=0,
        document_markdown=text,
        analysis_markdown=(
            "⚠️ The AI returned a malformed response after two attempts. "
            "Please try `/analyze` again or upload a shorter document."
        ),
        findings=[],
    )


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
