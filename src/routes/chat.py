from fastapi import APIRouter

from clients.openrouter import send_message
from core.logger import logger
from schemas.clients import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest) -> ChatResponse:
    """
    Send a simple text request to OpenRouter.
    The message should be in the 'message' key of the 'data' dict.
    """
    # Extract message from data dict, fallback to string representation if missing
    message = request.data.get("message")
    if not message:
        logger.warning(
            "No 'message' key found in request data, using full data as string"
        )
        message = str(request.data)

    logger.info("Sending message to AI", model=request.model)

    result = await send_message(user_message=message, model=request.model)

    return ChatResponse(result=result)
