from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
import jwt
from passlib.context import CryptContext

from config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


def create_access_token(
    data: dict[str, object],
    expires_delta: timedelta | None = None,
) -> str:
    """Encode *data* as a signed JWT with an expiry claim.

    Args:
        data: Payload to embed (must be JSON-serialisable).
        expires_delta: Token lifetime; defaults to settings.jwt_expire_minutes.

    Returns:
        Signed JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.jwt.expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(
        to_encode,
        settings.jwt.secret,
        algorithm=settings.jwt.algorithm,
    )


def decode_token(token: str) -> dict[str, object]:
    """Decode and validate *token*.

    Args:
        token: Signed JWT string.

    Returns:
        Decoded payload dict.

    Raises:
        HTTPException: 401 if the token is expired or invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt.secret,
            algorithms=[settings.jwt.algorithm],
        )
        return payload
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
