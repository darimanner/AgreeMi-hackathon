from __future__ import annotations

from typing import TYPE_CHECKING
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .chat import Chat
    from .message import Message
    from .user import User


class Attachment(Base, TimestampMixin):
    """File uploaded within a chat room.

    *markdown_content* holds the text extracted from the file (via markitdown).
    *ai_analysis* is populated after the /analyze command runs.
    """

    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    chat_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The message this attachment is associated with (nullable for standalone uploads).
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        Text, nullable=False, default="application/octet-stream"
    )
    # Text extracted from the file before sending to the AI.
    markdown_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Raw AI analysis response (stored as text; the structured form is on Chat.ai_analysis_json).
    ai_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relations
    chat: Mapped[Chat] = relationship(
        "Chat",
        back_populates="attachments",
    )
    message: Mapped[Message | None] = relationship(
        "Message",
        back_populates="attachments",
    )
    uploaded_by: Mapped[User | None] = relationship(
        "User",
        back_populates="attachments",
    )
