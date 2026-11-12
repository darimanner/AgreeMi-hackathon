from typing import Annotated
import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from core.security import decode_token
from models.user import User

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """Validate the Bearer JWT and return the corresponding User row.

    Args:
        credentials: HTTP Bearer credentials extracted from Authorization header.
        session: Async database session.

    Returns:
        Authenticated User ORM instance.

    Raises:
        HTTPException: 401 if token is invalid or user does not exist.
    """
    payload = decode_token(credentials.credentials)

    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    try:
        user_id = uuid.UUID(str(user_id_raw))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        ) from exc

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# Convenient type alias for route signatures.
CurrentUser = Annotated[User, Depends(get_current_user)]
DBSession = Annotated[AsyncSession, Depends(get_session)]
# User's own OpenRouter key; never stored or logged, only forwarded to OpenRouter.
OpenRouterKey = Annotated[str | None, Header(alias="X-OpenRouter-Key", max_length=256)]
