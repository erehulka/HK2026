# HK2026

Monorepo for HK2026 projects.

## Backend (FastAPI)

A base FastAPI app is available in the dedicated `backend/` folder.

### Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000/`.
