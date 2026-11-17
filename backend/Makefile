.PHONY: setup start start-dev init-alembic makemigrations migrate lint
export PYTHONPATH := src
ifneq (,$(wildcard .env))
  include .env
  export
endif

setup:
	uv venv
	uv sync

start:
	uv run alembic upgrade head
	uv run uvicorn src.main:app --host 0.0.0.0 --port 8000

start-dev:
	uv run alembic upgrade head
	uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

init-alembic:
	uv run alembic init -t async alembic

makemigrations:
	uv run alembic revision --autogenerate

migrate:
	uv run alembic upgrade head

lint:
	uv run ruff check . --fix
	uv run ruff format .
