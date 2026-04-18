"""Pydantic models for users stored in MongoDB `users` collection."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Validated body for creating a user."""

    display_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Human-readable name shown in clients",
    )
    email: EmailStr = Field(
        ...,
        max_length=320,
        description="Unique login identity; normalized to lowercase",
    )

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class UserOut(BaseModel):
    """User document returned to clients."""

    id: str
    display_name: str
    email: str
    created_at: datetime


def user_document_to_out(doc: dict) -> UserOut:
    """Map a MongoDB user document to `UserOut`."""
    return UserOut(
        id=str(doc["_id"]),
        display_name=doc["display_name"],
        email=doc["email"],
        created_at=doc["created_at"],
    )
