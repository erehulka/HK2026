"""Pydantic models for Splitwise-style expenses."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, field_validator

from app.schemas.item import _amount_from_mongo

if TYPE_CHECKING:
    from app.schemas.item import ItemOut


class ExpenseCreate(BaseModel):
    """Body for creating an expense in a group."""

    description: str = Field(..., min_length=1, max_length=5000)
    created_by: str = Field(..., description="User who created the expense")

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class ExpenseUpdate(BaseModel):
    """Partial update for an expense (PATCH)."""

    description: str | None = Field(default=None, min_length=1, max_length=5000)
    created_by: str | None = None

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v


class ExpenseOut(BaseModel):
    """Expense returned to clients."""

    id: str
    group_id: str
    description: str
    total_amount: int = Field(description="Total amount in euro cents (100 = €1.00)")
    created_by: str
    participants: list[str]
    items: list[str]
    created_at: datetime
    updated_at: datetime


class ExpenseDetailOut(ExpenseOut):
    """Expense returned with populated item documents."""

    items: list["ItemOut"]


def expense_document_to_out(doc: dict) -> ExpenseOut:
    """Map a MongoDB expense document to `ExpenseOut`."""
    return ExpenseOut(
        id=str(doc["_id"]),
        group_id=str(doc["groupId"]),
        description=doc["description"],
        total_amount=_amount_from_mongo(doc["totalAmount"], field="totalAmount"),
        created_by=str(doc["createdBy"]),
        participants=[str(uid) for uid in doc.get("participantUserIds", [])],
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
        participants=[str(uid) for uid in doc.get("participantUserIds", [])],
        items=[item_document_to_out(item) for item in items],
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )
