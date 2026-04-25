from __future__ import annotations

import secrets
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import Column, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .analysis_version import AnalysisVersion
    from .file import Attachment
    from .message import Message
    from .user import User


def _generate_invite_code() -> str:
    return secrets.token_urlsafe(8)


chat_developers = Table(
    "chat_developers",
    Base.metadata,
    Column("chat_id", ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

chat_clients = Table(
    "chat_clients",
    Base.metadata,
    Column("chat_id", ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Chat(Base, TimestampMixin):
    """A chat room with multiple developers and clients."""

    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invite_code: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, default=_generate_invite_code, index=True
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_analysis_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    developers: Mapped[list[User]] = relationship(
        "User",
        secondary=chat_developers,
        back_populates="developer_chats",
    )
    clients: Mapped[list[User]] = relationship(
        "User",
        secondary=chat_clients,
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
    analysis_versions: Mapped[list[AnalysisVersion]] = relationship(
        "AnalysisVersion",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="AnalysisVersion.version_number",
    )

    @property
    def developer_ids(self) -> list[uuid.UUID]:
        return [u.id for u in self.developers]

    @property
    def client_ids(self) -> list[uuid.UUID]:
        return [u.id for u in self.clients]
