from datetime import datetime
from enum import StrEnum
import uuid

from pydantic import BaseModel, Field

from models.message import MessageRole
from schemas.analysis import AnalysisResult


class AttachmentOut(BaseModel):
    """Minimal attachment representation embedded in MessageOut."""

    id: uuid.UUID
    filename: str
    content_type: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    """Message representation returned to the frontend.

    Datetimes are serialised as ISO-8601 strings by Pydantic v2 automatically
    when *model_config.json_encoders* is not overridden — FastAPI's JSONResponse
    handles the conversion via the Pydantic model.
    """

    id: uuid.UUID
    chat_id: uuid.UUID
    author_id: uuid.UUID | None
    role: MessageRole
    content: str
    timestamp: datetime = Field(alias="created_at")
    attachments: list[AttachmentOut] = Field(default_factory=list)

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,  # allow both alias and field name
    }


class SendMessageRequest(BaseModel):
    """Form-data fields for POST /chats/{id}/messages.

    The optional *file* is handled separately as UploadFile in the route.
    """

    content: str = Field(..., min_length=1)


class CommandName(StrEnum):
    """Supported slash commands."""

    UPDATE = "/update"
    ANALYZE = "/analyze"


class CommandRequest(BaseModel):
    """Payload for POST /chats/{id}/commands."""

    command: CommandName


class CommandResponse(BaseModel):
    """Result of a slash command execution."""

    command: CommandName
    result: str
    message: MessageOut
    analysis: AnalysisResult | None = None
