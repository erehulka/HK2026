"""Pydantic models for Splitwise-style expenses."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.item import ItemCreate, ItemOut, _amount_from_mongo


class ExpenseSplitType(str, Enum):
    EQUAL = "Equal"
    SHARES = "Shares"


def _amount_cents_from_mongo(value: Any) -> int:
    """Read stored expense total as integer euro cents."""
    if type(value) is bool:
        msg = "amount must not be a boolean"
        raise TypeError(msg)
    if isinstance(value, int):
        return value
    msg = f"Unsupported amount type: {type(value)}"
    raise TypeError(msg)


def read_stored_expense_amount_cents(value: Any) -> int:
    """Read an ``amount`` field from MongoDB (integer euro cents)."""
    return _amount_cents_from_mongo(value)


class ExpenseCreate(BaseModel):
    """Body for creating an expense in a group."""

    description: str = Field(..., min_length=1, max_length=5000)
    created_by: str = Field(..., description="User who created the expense")
    paid_by: str = Field(..., description="User who paid for the expense")
    participants: list[str] = Field(
        ...,
        min_length=1,
        description="Users participating in this expense",
    )
    split_type: ExpenseSplitType = Field(
        default=ExpenseSplitType.EQUAL,
        description="How the expense is split",
    )

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("participants")
    @classmethod
    def unique_participants(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("participants must be unique")
        return v


class ExpenseFrontendCreate(BaseModel):
    """Body used by the frontend to create an expense and its items in one request."""

    description: str = Field(..., min_length=1, max_length=5000)
    paid_by: str = Field(..., description="User who paid for the expense")
    participant_user_ids: list[str] = Field(
        ...,
        min_length=1,
        description="Users participating in this expense",
    )
    split_type: ExpenseSplitType = Field(
        default=ExpenseSplitType.EQUAL,
        description="How the expense is split",
    )
    items: list[ItemCreate] = Field(
        ...,
        min_length=1,
        description="Expense items to create",
    )

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("participant_user_ids")
    @classmethod
    def unique_participants(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("participant_user_ids must be unique")
        return v


class ExpenseUpdate(BaseModel):
    """Partial update for an expense (PATCH)."""

    description: str | None = Field(default=None, min_length=1, max_length=5000)
    created_by: str | None = None
    paid_by: str | None = None
    participants: list[str] | None = Field(default=None, min_length=1)
    split_type: ExpenseSplitType | None = None

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("participants")
    @classmethod
    def unique_participants(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(set(v)) != len(v):
            raise ValueError("participants must be unique")
        return v


class ExpenseOut(BaseModel):
    """Expense returned to clients."""

    id: str
    group_id: str
    description: str
    total_amount: int = Field(description="Total amount in euro cents (100 = €1.00)")
    created_by: str
    paid_by: str
    participants: list[str]
    split_type: ExpenseSplitType
    items: list[str]
    created_at: datetime
    updated_at: datetime


class ExpenseDetailOut(ExpenseOut):
    """Expense returned with populated item documents."""

    items: list[ItemOut]


_MISSING = object()


def _mongo_list(doc: dict, *, key: str, default: object = _MISSING) -> list[object]:
    if key in doc:
        value = doc[key]
    elif default is not _MISSING:
        value = default
    else:
        msg = f"Missing '{key}' in expense document"
        raise KeyError(msg)
    if isinstance(value, list):
        return value
    msg = f"Expected list for '{key}', got {type(value)}"
    raise TypeError(msg)


def _split_type_from_mongo(value: object) -> ExpenseSplitType:
    """Normalize persisted split type values to `ExpenseSplitType`."""
    if isinstance(value, ExpenseSplitType):
        return value
    if value is None:
        return ExpenseSplitType.EQUAL
    if isinstance(value, str):
        normalized = value.lower()
        if normalized == ExpenseSplitType.EQUAL.value.lower():
            return ExpenseSplitType.EQUAL
        if normalized == ExpenseSplitType.SHARES.value.lower():
            return ExpenseSplitType.SHARES
    try:
        return ExpenseSplitType(value)
    except ValueError:
        return ExpenseSplitType.EQUAL


def expense_document_to_out(doc: dict) -> ExpenseOut:
    """Map a MongoDB expense document to `ExpenseOut`."""
    return ExpenseOut(
        id=str(doc["_id"]),
        group_id=str(doc["group_id"]),
        description=doc["description"],
        total_amount=_amount_from_mongo(doc["total_amount"], field="total_amount"),
        created_by=str(doc["created_by"]),
        paid_by=str(doc["paid_by"]),
        participants=[str(uid) for uid in _mongo_list(doc, key="participant_user_ids")],
        split_type=_split_type_from_mongo(
            doc.get("split_type", ExpenseSplitType.EQUAL.value)
        ),
        items=[str(item_id) for item_id in doc.get("items", [])],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def expense_document_to_detail_out(doc: dict, items: list[dict]) -> ExpenseDetailOut:
    """Map a MongoDB expense document and its items to `ExpenseDetailOut`."""
    from app.schemas.item import item_document_to_out

    return ExpenseDetailOut(
        id=str(doc["_id"]),
        group_id=str(doc["group_id"]),
        description=doc["description"],
        total_amount=_amount_from_mongo(doc["total_amount"], field="total_amount"),
        created_by=str(doc["created_by"]),
        paid_by=str(doc["paid_by"]),
        participants=[str(uid) for uid in _mongo_list(doc, key="participant_user_ids")],
        split_type=_split_type_from_mongo(
            doc.get("split_type", ExpenseSplitType.EQUAL.value)
        ),
        items=[item_document_to_out(item) for item in items],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
