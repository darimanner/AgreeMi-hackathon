.PHONY: setup start start-dev lint requirements
export PYTHONPATH := src
ifneq (,$(wildcard .env))
  include .env
  export
endif

start:
	uv run uvicorn src.main:app --host --port 8000

start-dev:
	uv run uvicorn src.main:app --host --port 8000 --reload

# init-alembic:
# 	uv run alembic init -t async alembic

# makemigrations:
# 	uv run alembic revision --autogenerate

# migrate:
# 	uv run alembic upgrade head

lint:
	uv run ruff check . --fix
	uv run ruff format .

requirements:
	uv export --format requirements.txt
