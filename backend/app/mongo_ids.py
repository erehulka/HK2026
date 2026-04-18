"""Helpers for MongoDB BSON ObjectId values in path/query parameters."""

from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def parse_object_id(value: str, *, field: str) -> ObjectId:
    """Parse a 24-hex string into an ObjectId or raise HTTP 400."""
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ObjectId for {field}",
        ) from exc
