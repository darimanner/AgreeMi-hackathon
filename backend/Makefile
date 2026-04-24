.PHONY: setup requirements start start-dev lint
export PYTHONPATH := src
ifneq (,$(wildcard .env))
  include .env
  export
endif

setup:
	uv venv
	uv sync

requirements:
	uv export --format requirements.txt > requirements.txt

start:
	uv run uvicorn src.main:app --host 0.0.0.0 --port 8001

start-dev:
	uv run uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload

# init-alembic:
# 	uv run alembic init -t async alembic

# makemigrations:
# 	uv run alembic revision --autogenerate

# migrate:
# 	uv run alembic upgrade head

lint:
	uv run ruff check . --fix
	uv run ruff format .
