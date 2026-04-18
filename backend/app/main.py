from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import get_database
from app.db.indexes import ensure_indexes
from app.routers import expenses, groups, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes(get_database())
    yield


app = FastAPI(title="HK2026 Backend", lifespan=lifespan)
app.include_router(groups.router)
app.include_router(users.router)
app.include_router(expenses.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "HK2026 backend is running"}
