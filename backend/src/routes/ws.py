import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.logger import logger
from core.security import decode_token
from core.ws_manager import manager

router = APIRouter()


@router.websocket("/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: uuid.UUID,
    token: str = Query(..., description="JWT access token"),
) -> None:
    """WebSocket connection for a specific chat room.

    The client passes the JWT as the *token* query parameter because the
    browser WebSocket API does not support custom headers.

    On connection, the JWT is validated.  All future messages are broadcast
    from the server (via the REST send-message endpoint); the client does not
    need to send messages over this socket.

    Args:
        websocket: The incoming WebSocket connection.
        chat_id: UUID of the chat room to subscribe to.
        token: JWT access token passed as a query parameter.
    """
    # Validate JWT before accepting the connection.
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await manager.connect(chat_id, websocket)
    logger.info("WebSocket connection established", chat_id=str(chat_id))

    try:
        # Keep the connection alive; we only broadcast from the server side.
        while True:
            # Drain any client frames to prevent buffer buildup (ping/pong etc.).
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected", chat_id=str(chat_id))
    finally:
        manager.disconnect(chat_id, websocket)
