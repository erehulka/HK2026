"""Pydantic models for group API payloads and responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class GroupCreate(BaseModel):
    """Validated body for creating a group (stored in MongoDB `groups` collection)."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Display name for the group",
    )
    description: str = Field(
        ...,
        max_length=5000,
        description="Longer text describing the group; may be empty",
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class GroupOut(BaseModel):
    """Group document returned to clients."""

    id: str
    name: str
    description: str
    created_at: datetime


def group_document_to_out(doc: dict) -> GroupOut:
    """Map a MongoDB group document to `GroupOut`."""
    return GroupOut(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc["description"],
        created_at=doc["created_at"],
    )
