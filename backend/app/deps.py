"""FastAPI dependencies shared across routers."""

from __future__ import annotations

from pymongo.database import Database

from app.db import get_database


def get_db() -> Database:
    return get_database()
