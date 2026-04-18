"""Pydantic models for Splitwise-style expense items."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator


def _amount_from_mongo(value: Any, *, field: str) -> int:
    """Read stored monetary value as integer cents."""
    if type(value) is bool:
        msg = f"{field} must not be a boolean"
        raise TypeError(msg)
    if isinstance(value, int):
        return value
    msg = f"Unsupported {field} type: {type(value)}"
    raise TypeError(msg)


def _ensure_int_amount(v: object, *, field: str) -> object:
    if isinstance(v, bool):
        raise ValueError(f"{field} must be an integer (euro cents), not a boolean")
    if isinstance(v, float):
        raise ValueError(f"{field} must be an integer (euro cents), not a float")
    return v


class ItemCreate(BaseModel):
    """Body for creating an item under an expense."""

    description: str = Field(..., min_length=1, max_length=5000)
    amount: Annotated[
        int,
        Field(
            gt=0,
            le=10**15,
            description="Item amount in euro cents (100 = €1.00)",
        ),
    ]
    paid_by: str = Field(..., description="User who paid this item")
    created_by: str = Field(..., description="User who created this item")

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("amount", mode="before")
    @classmethod
    def amount_integer_cents(cls, v: object) -> object:
        return _ensure_int_amount(v, field="amount")


class ItemUpdate(BaseModel):
    """Partial update for an expense item."""

    description: str | None = Field(default=None, min_length=1, max_length=5000)
    amount: Annotated[
        int | None,
        Field(
            default=None,
            gt=0,
            le=10**15,
            description="Item amount in euro cents (100 = €1.00)",
        ),
    ] = None
    paid_by: str | None = None
    created_by: str | None = None

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("amount", mode="before")
    @classmethod
    def amount_integer_cents(cls, v: object) -> object:
        if v is None:
            return v
        return _ensure_int_amount(v, field="amount")


class ItemOut(BaseModel):
    """Item returned to clients."""

    id: str
    expense_id: str
    description: str
    amount: int
    paid_by: str
    created_at: datetime
    updated_at: datetime
    created_by: str


def item_document_to_out(doc: dict) -> ItemOut:
    """Map a MongoDB item document to `ItemOut`."""
    return ItemOut(
        id=str(doc["_id"]),
        expense_id=str(doc["expenseId"]),
        description=doc["description"],
        amount=_amount_from_mongo(doc["amount"], field="amount"),
        paid_by=str(doc["paidBy"]),
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
        created_by=str(doc["createdBy"]),
    )
