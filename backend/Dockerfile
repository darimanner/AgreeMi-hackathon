FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Create and change to the app directory.
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    WORKDIR=/app \
    PYTHONPATH=/app/src

# Copy local code to the container image.
COPY . .

# Install project dependencies
RUN uv pip install --system --no-cache -r requirements.txt

# Run the web service on container startup.
CMD ["hypercorn", "src.main:app", "--bind", "::8000"]
