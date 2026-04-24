from openai import AsyncOpenAI

from config import settings
from core.logger import logger
from core.prompts import ANALYZE_PDF_PROMPT

DEFAULT_MODEL = "meta-llama/llama-3.3-8b-instruct:free"

openrouter_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.api_tokens.openrouter,
)


async def send_message(
    user_message: str,
    model: str = DEFAULT_MODEL,
    system_prompt: str | None = None,
) -> str:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    try:
        completion = await openrouter_client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
        )
        return completion.choices[0].message.content or ""
    except Exception as error:
        logger.error("Failed to get response from OpenRouter", error=str(error))
        raise


async def analyze_pdf_markdown(
    markdown_content: str,
    user_prompt: str | None = None,
    model: str = DEFAULT_MODEL,
) -> tuple[str, str]:
    """Analyze PDF markdown content. Returns (analysis, model_used)."""
    user_message = markdown_content
    if user_prompt:
        user_message = f"{user_prompt}\n\n---\n\n{markdown_content}"

    analysis = await send_message(
        user_message=user_message,
        model=model,
        system_prompt=ANALYZE_PDF_PROMPT,
    )
    return analysis, model
