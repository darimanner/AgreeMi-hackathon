from .analysis import router as analysis_router
from .auth import router as auth_router
from .chat import router as chat_router
from .commands import router as commands_router
from .messages import router as messages_router
from .ws import router as ws_router

__all__ = [
    "analysis_router",
    "auth_router",
    "chat_router",
    "commands_router",
    "messages_router",
    "ws_router",
]
