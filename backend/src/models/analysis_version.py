from __future__ import annotations

from typing import TYPE_CHECKING
import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .chat import Chat
    from .file import Attachment


class AnalysisVersion(Base, TimestampMixin):
    """One versioned snapshot of an /analyze result for a chat room."""

    __tablename__ = "analysis_versions"
    __table_args__ = (
        UniqueConstraint(
            "chat_id", "version_number", name="uq_analysis_version_chat_num"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("attachments.id", ondelete="SET NULL"), nullable=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    analysis_json: Mapped[dict] = mapped_column(JSONB, nullable=False)

    chat: Mapped[Chat] = relationship("Chat", back_populates="analysis_versions")
    attachment: Mapped[Attachment | None] = relationship("Attachment")
