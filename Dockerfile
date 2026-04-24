FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Create and change to the app directory.
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src

# Copy project files
COPY . .

# Install dependencies using uv
RUN uv sync --frozen --no-cache

# Run migrations and then start the web service.
# 'exec' ensures the app receives signals (like SIGTERM) directly.
CMD sh -c "uv run alembic upgrade head && exec uv run hypercorn src.main:app --bind 0.0.0.0:${PORT:-8000}"
