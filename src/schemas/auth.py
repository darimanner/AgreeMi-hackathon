import uuid

from pydantic import BaseModel, EmailStr, Field

from models.user import UserRole


class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.CLIENT


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Returned after successful login or registration."""

    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Public user representation (no password hash)."""

    id: uuid.UUID
    email: str
    name: str
    role: UserRole

    model_config = {"from_attributes": True}
