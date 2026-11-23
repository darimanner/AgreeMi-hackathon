from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class ChatCreate(BaseModel):
    title: str | None = Field(None, max_length=255)


class ChatOut(BaseModel):
    id: uuid.UUID
    title: str | None
    invite_code: str
    developer_ids: list[uuid.UUID]
    client_ids: list[uuid.UUID]
    ai_analysis_json: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatListItem(BaseModel):
    id: uuid.UUID
    title: str | None
    invite_code: str
    developer_ids: list[uuid.UUID]
    client_ids: list[uuid.UUID]
    # The SPA restores the analysis panel from here after a reload or on the other side of the chat.
    ai_analysis_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class JoinResponse(BaseModel):
    chat: ChatOut
    message: str = "Joined successfully"
