from __future__ import annotations

import secrets
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .file import Attachment
    from .message import Message
    from .user import User


def _generate_invite_code() -> str:
    """Generate a short URL-safe invite code (11 characters)."""
    return secrets.token_urlsafe(8)


class Chat(Base, TimestampMixin):
    """A chat room linking one developer and one client."""

    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    # Shareable invite code — clients join via POST /chats/join/{invite_code}
    invite_code: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        default=_generate_invite_code,
        index=True,
    )

    developer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stores the latest structured AI analysis result.
    # Shape: {score, summary, issues: [{id, severity, title, description, suggestion}]}
    ai_analysis_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relations
    developer: Mapped[User] = relationship(
        "User",
        foreign_keys=[developer_id],
        back_populates="developer_chats",
    )
    client: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[client_id],
        back_populates="client_chats",
    )
    messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    attachments: Mapped[list[Attachment]] = relationship(
        "Attachment",
        back_populates="chat",
        cascade="all, delete-orphan",
    )
