"""MongoDB Atlas connection using credentials from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

# Load `.env` from the backend package root (directory that contains `app/`).
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env")


def _require_uri() -> str:
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        msg = (
            "MONGODB_URI is not set. Copy .env.example to .env in the backend "
            "folder and add your Atlas connection string."
        )
        raise RuntimeError(msg)
    return uri


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    """Return a shared MongoClient (thread-safe; reuse across requests)."""
    # Use certifi's CA bundle so TLS works on macOS python.org builds that lack
    # system trust store wiring (Atlas: CERTIFICATE_VERIFY_FAILED otherwise).
    return MongoClient(_require_uri(), tlsCAFile=certifi.where())


def get_database(name: str | None = None) -> Database:
    """Return a database handle; uses MONGODB_DB_NAME when name is omitted."""
    db_name = (name or os.environ.get("MONGODB_DB_NAME", "")).strip()
    if not db_name:
        raise RuntimeError(
            "Database name missing: pass name=... or set MONGODB_DB_NAME in .env"
        )
    return get_mongo_client()[db_name]
