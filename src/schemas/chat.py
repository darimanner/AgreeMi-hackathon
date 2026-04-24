"""Pydantic v2 schemas for chat room endpoints."""

from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class ChatCreate(BaseModel):
    """Payload for POST /chats."""

    title: str | None = Field(None, max_length=255)


class ChatOut(BaseModel):
    """Full chat room representation returned to the caller."""

    id: uuid.UUID
    title: str | None
    invite_code: str
    developer_id: uuid.UUID
    client_id: uuid.UUID | None
    ai_analysis_json: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatListItem(BaseModel):
    """Summary representation used in GET /chats list response."""

    id: uuid.UUID
    title: str | None
    invite_code: str
    developer_id: uuid.UUID
    client_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class JoinResponse(BaseModel):
    """Returned after successfully joining a chat via invite code."""

    chat: ChatOut
    message: str = "Joined successfully"
