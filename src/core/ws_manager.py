from typing import Any
import uuid

from fastapi import WebSocket

from core.logger import logger


class ConnectionManager:
    """Tracks active WebSocket connections grouped by chat_id.

    This is a simple in-memory registry.  It works correctly for a single
    process (single Uvicorn worker).  For multi-worker deployments, replace
    the broadcast mechanism with Redis Pub/Sub.
    """

    def __init__(self) -> None:
        # chat_id → list of active connections
        self._active: dict[uuid.UUID, list[WebSocket]] = {}

    async def connect(self, chat_id: uuid.UUID, websocket: WebSocket) -> None:
        """Accept the connection and register it under *chat_id*."""
        await websocket.accept()
        self._active.setdefault(chat_id, []).append(websocket)
        logger.debug(
            "WebSocket connected",
            chat_id=str(chat_id),
            total=len(self._active[chat_id]),
        )

    def disconnect(self, chat_id: uuid.UUID, websocket: WebSocket) -> None:
        """Remove *websocket* from the registry for *chat_id*."""
        connections = self._active.get(chat_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self._active.pop(chat_id, None)
        logger.debug("WebSocket disconnected", chat_id=str(chat_id))

    async def broadcast(self, chat_id: uuid.UUID, payload: dict[str, Any]) -> None:
        """Send *payload* as JSON to every connection in *chat_id*.

        Connections that fail are silently removed to avoid blocking the rest.
        """
        connections = list(self._active.get(chat_id, []))
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(chat_id, ws)


# Singleton — imported directly by routes.
manager = ConnectionManager()
