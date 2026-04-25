from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .chat import Chat
    from .file import Attachment
    from .message import Message


class UserRole(StrEnum):
    CLIENT = "client"
    DEVELOPER = "developer"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.CLIENT
    )

    developer_chats: Mapped[list[Chat]] = relationship(
        "Chat",
        secondary="chat_developers",
        back_populates="developers",
    )
    client_chats: Mapped[list[Chat]] = relationship(
        "Chat",
        secondary="chat_clients",
        back_populates="clients",
    )
    messages: Mapped[list[Message]] = relationship("Message", back_populates="author")
    attachments: Mapped[list[Attachment]] = relationship(
        "Attachment", back_populates="uploaded_by"
    )
