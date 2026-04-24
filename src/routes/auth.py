from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from core.logger import logger
from core.security import create_access_token, hash_password, verify_password
from deps import DBSession
from models.user import User
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter()


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(payload: RegisterRequest, session: DBSession) -> UserOut:
    """Create a new user account.

    Args:
        payload: Registration data (email, password, name, role).
        session: Async database session.

    Returns:
        Created user (without password hash).

    Raises:
        HTTPException: 409 if email is already registered.
    """
    # Check for duplicate email.
    existing = await session.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role=payload.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info("User registered", user_id=str(user.id), email=user.email, role=user.role)
    return UserOut.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain a JWT",
)
async def login(payload: LoginRequest, session: DBSession) -> TokenResponse:
    """Validate credentials and return a signed JWT.

    Args:
        payload: Login data (email, password).
        session: Async database session.

    Returns:
        JWT access token.

    Raises:
        HTTPException: 401 on invalid credentials.
    """
    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Use the same error message for missing user and wrong password to avoid
    # user enumeration.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid

    token = create_access_token({"sub": str(user.id), "role": user.role})
    logger.info("User logged in", user_id=str(user.id))
    return TokenResponse(access_token=token)
