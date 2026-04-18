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


def expense_document_to_out(doc: dict) -> ExpenseOut:
    """Map a MongoDB expense document to `ExpenseOut`."""
    return ExpenseOut(
        id=str(doc["_id"]),
        group_id=str(doc["groupId"]),
        description=doc["description"],
        total_amount=_amount_from_mongo(doc["totalAmount"], field="totalAmount"),
        created_by=str(doc["createdBy"]),
        paid_by=str(doc["paidBy"]),
        participants=[str(uid) for uid in doc.get("participantUserIds", [])],
        split_type=ExpenseSplitType(doc.get("splitType", ExpenseSplitType.EQUAL.value)),
        items=[str(item_id) for item_id in doc.get("items", [])],
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )


def expense_document_to_detail_out(doc: dict, items: list[dict]) -> ExpenseDetailOut:
    """Map a MongoDB expense document and its items to `ExpenseDetailOut`."""
    from app.schemas.item import item_document_to_out

    return ExpenseDetailOut(
        id=str(doc["_id"]),
        group_id=str(doc["groupId"]),
        description=doc["description"],
        total_amount=_amount_from_mongo(doc["totalAmount"], field="totalAmount"),
        created_by=str(doc["createdBy"]),
        paid_by=str(doc["paidBy"]),
        participants=[str(uid) for uid in doc.get("participantUserIds", [])],
        split_type=ExpenseSplitType(doc.get("splitType", ExpenseSplitType.EQUAL.value)),
        items=[item_document_to_out(item) for item in items],
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )
