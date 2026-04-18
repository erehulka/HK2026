"""Pydantic models for group expenses stored in MongoDB `expenses` collection."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Optional

from pydantic import BaseModel, Field, field_validator


class ExpenseSplitType(str, Enum):
    """How the expense is split across participants."""

    EVENLY = "evenly"


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


# TODO: Expenses should not have a persisted or request-level root `amount`; the
# total should be calculated as the sum of line-item amounts (each in euro cents)
# once `items` exist.


class ExpenseCreate(BaseModel):
    """Body for creating an expense in a group."""

    amount: Annotated[
        int,
        Field(
            gt=0,
            le=10**15,
            description="Total amount in euro cents (100 = €1.00)",
        ),
    ]
    participant_user_ids: list[str] = Field(
        ...,
        min_length=1,
        description="Users sharing this expense; must be members of the group",
    )
    paid_by_user_id: str = Field(..., description="User who paid; must be among participants")
    type: ExpenseSplitType = Field(
        default=ExpenseSplitType.EVENLY,
        description="Split strategy",
    )
    items: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Line items (unsupported for now; must be empty)",
    )

    @field_validator("amount", mode="before")
    @classmethod
    def amount_integer_cents(cls, v: object) -> object:
        if isinstance(v, bool):
            raise ValueError("amount must be an integer (euro cents), not a boolean")
        if isinstance(v, float):
            raise ValueError("amount must be an integer (euro cents), not a float")
        return v

    @field_validator("participant_user_ids")
    @classmethod
    def no_duplicate_participants(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("participant_user_ids must be unique")
        return v

    @field_validator("items")
    @classmethod
    def items_must_be_empty(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if v:
            raise ValueError("items must be empty for now")
        return v


class ExpenseUpdate(BaseModel):
    """Partial update for an expense (PATCH)."""

    amount: Annotated[
        Optional[int],
        Field(
            default=None,
            gt=0,
            le=10**15,
            description="Total amount in euro cents (100 = €1.00)",
        ),
    ] = None
    participant_user_ids: Optional[list[str]] = Field(
        default=None,
        min_length=1,
        description="Users sharing this expense; must be members of the group",
    )
    paid_by_user_id: Optional[str] = None
    type: Optional[ExpenseSplitType] = None
    items: Optional[list[dict[str, Any]]] = None

    @field_validator("amount", mode="before")
    @classmethod
    def amount_integer_cents(cls, v: object) -> object:
        if v is None:
            return v
        if isinstance(v, bool):
            raise ValueError("amount must be an integer (euro cents), not a boolean")
        if isinstance(v, float):
            raise ValueError("amount must be an integer (euro cents), not a float")
        return v

    @field_validator("participant_user_ids")
    @classmethod
    def no_duplicate_participants(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        if len(set(v)) != len(v):
            raise ValueError("participant_user_ids must be unique")
        return v

    @field_validator("items")
    @classmethod
    def items_must_be_empty(cls, v: Optional[list[dict[str, Any]]]) -> Optional[list[dict[str, Any]]]:
        if v is not None and len(v) > 0:
            raise ValueError("items must be empty for now")
        return v


class ExpenseOut(BaseModel):
    """Expense returned to clients."""

    id: str
    group_id: str
    amount: int = Field(description="Total amount in euro cents (100 = €1.00)")
    participant_user_ids: list[str]
    paid_by_user_id: str
    type: ExpenseSplitType
    items: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


def expense_document_to_out(doc: dict) -> ExpenseOut:
    """Map a MongoDB expense document to `ExpenseOut`."""
    return ExpenseOut(
        id=str(doc["_id"]),
        group_id=str(doc["group_id"]),
        amount=_amount_cents_from_mongo(doc["amount"]),
        participant_user_ids=[str(uid) for uid in doc["participant_user_ids"]],
        paid_by_user_id=str(doc["paid_by_user_id"]),
        type=ExpenseSplitType(doc["type"]),
        items=list(doc.get("items") or []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
