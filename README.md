# HK2026

Monorepo for HK2026 projects.

## Backend (FastAPI)

The API lives in `backend/` and uses [Poetry](https://python-poetry.org/) for dependencies and a lockfile (`backend/poetry.lock`). Python **3.9+** is required (see `backend/pyproject.toml`). Install [Poetry](https://python-poetry.org/docs/#installation) first, then:

### Run locally

```bash
cd backend
poetry install
cp .env.example .env
# Set MONGODB_URI and MONGODB_DB_NAME in .env for MongoDB Atlas.
poetry run uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000/`.

API docs: `http://127.0.0.1:8000/docs`.

### Run tests

From the repo root (or after `cd backend`):

```bash
cd backend
poetry install --with dev
poetry run pytest
```

Run a single file or with verbose output:

```bash
poetry run pytest tests/test_debts_simplify.py -v
```

Tests live under `backend/tests/` and do not require MongoDB or `.env` unless a test explicitly needs them.

### Dependencies

- Change versions in `backend/pyproject.toml`, then run `poetry lock` and `poetry install`.
- If you need a `requirements.txt` for a pip-only deploy step, generate it with  
  `poetry export -f requirements.txt --output requirements.txt --without-hashes`  
  (you may need `poetry self add poetry-plugin-export` depending on your Poetry version).
