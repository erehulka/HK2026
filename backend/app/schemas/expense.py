"""Pydantic models for Splitwise-style expenses."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.schemas.item import ItemCreate, ItemOut, _amount_from_mongo


class ExpenseSplitType(str, Enum):
    EQUAL = "Equal"
    SHARES = "Shares"


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
    paidBy: str = Field(..., description="User who paid for the expense")
    participantUserIds: list[str] = Field(
        ...,
        min_length=1,
        description="Users participating in this expense",
    )
    splitType: ExpenseSplitType = Field(
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

    @field_validator("participantUserIds")
    @classmethod
    def unique_participants(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("participantUserIds must be unique")
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


def _mongo_value(
    doc: dict,
    *,
    snake_key: str,
    camel_key: str,
    default: object = _MISSING,
) -> object:
    """Read a value from snake_case key first, then camelCase fallback."""
    if snake_key in doc:
        return doc[snake_key]
    if camel_key in doc:
        return doc[camel_key]
    if default is not _MISSING:
        return default
    msg = f"Missing '{snake_key}'/'{camel_key}' in expense document"
    raise KeyError(msg)


def _mongo_list(doc: dict, *, snake_key: str, camel_key: str) -> list[object]:
    value = _mongo_value(doc, snake_key=snake_key, camel_key=camel_key, default=[])
    if isinstance(value, list):
        return value
    msg = f"Expected list for '{snake_key}'/'{camel_key}', got {type(value)}"
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
        group_id=str(_mongo_value(doc, snake_key="group_id", camel_key="groupId")),
        description=doc["description"],
        total_amount=_amount_from_mongo(
            _mongo_value(doc, snake_key="total_amount", camel_key="totalAmount"),
            field="total_amount",
        ),
        created_by=str(_mongo_value(doc, snake_key="created_by", camel_key="createdBy")),
        paid_by=str(_mongo_value(doc, snake_key="paid_by", camel_key="paidBy")),
        participants=[
            str(uid)
            for uid in _mongo_list(
                doc,
                snake_key="participant_user_ids",
                camel_key="participantUserIds",
            )
        ],
        split_type=_split_type_from_mongo(
            _mongo_value(
                doc,
                snake_key="split_type",
                camel_key="splitType",
                default=ExpenseSplitType.EQUAL.value,
            )
        ),
        items=[str(item_id) for item_id in doc.get("items", [])],
        created_at=_mongo_value(doc, snake_key="created_at", camel_key="createdAt"),
        updated_at=_mongo_value(doc, snake_key="updated_at", camel_key="updatedAt"),
    )


def expense_document_to_detail_out(doc: dict, items: list[dict]) -> ExpenseDetailOut:
    """Map a MongoDB expense document and its items to `ExpenseDetailOut`."""
    from app.schemas.item import item_document_to_out

    return ExpenseDetailOut(
        id=str(doc["_id"]),
        group_id=str(_mongo_value(doc, snake_key="group_id", camel_key="groupId")),
        description=doc["description"],
        total_amount=_amount_from_mongo(
            _mongo_value(doc, snake_key="total_amount", camel_key="totalAmount"),
            field="total_amount",
        ),
        created_by=str(_mongo_value(doc, snake_key="created_by", camel_key="createdBy")),
        paid_by=str(_mongo_value(doc, snake_key="paid_by", camel_key="paidBy")),
        participants=[
            str(uid)
            for uid in _mongo_list(
                doc,
                snake_key="participant_user_ids",
                camel_key="participantUserIds",
            )
        ],
        split_type=_split_type_from_mongo(
            _mongo_value(
                doc,
                snake_key="split_type",
                camel_key="splitType",
                default=ExpenseSplitType.EQUAL.value,
            )
        ),
        items=[item_document_to_out(item) for item in items],
        created_at=_mongo_value(doc, snake_key="created_at", camel_key="createdAt"),
        updated_at=_mongo_value(doc, snake_key="updated_at", camel_key="updatedAt"),
    )
