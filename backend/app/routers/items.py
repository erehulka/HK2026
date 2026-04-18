"""HTTP routes for items nested under group expenses."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database

from app.deps import get_db
from app.mongo_ids import parse_object_id
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate, item_document_to_out

router = APIRouter(
    prefix="/groups/{group_id}/expenses",
    tags=["items"],
)


def _require_group(db: Database, gid: ObjectId) -> None:
    if db.groups.find_one({"_id": gid}) is None:
        raise HTTPException(status_code=404, detail="Group not found")


def _member_ids(db: Database, gid: ObjectId) -> set[ObjectId]:
    return {
        doc["user_id"]
        for doc in db.group_memberships.find({"group_id": gid}, {"user_id": 1})
    }


def _validate_membership(
    user_id: ObjectId,
    members: set[ObjectId],
    *,
    field: str,
) -> None:
    if user_id not in members:
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be a member of this group",
        )


def _total_amount_from_items(item_docs: list[dict]) -> int:
    """Compute expense total as the sum of item amounts."""
    total = 0
    for item in item_docs:
        amount = item["amount"]
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise HTTPException(
                status_code=500,
                detail="Stored item amount must be an integer",
            )
        total += amount
    return total


def _refresh_expense_totals(db: Database, expense_id: ObjectId) -> dict | None:
    """Refresh stored totals and item ids from the item's current state."""
    item_docs = list(db.items.find({"expenseId": expense_id}))
    total_amount = _total_amount_from_items(item_docs)
    now = datetime.now(timezone.utc)
    return db.expenses.find_one_and_update(
        {"_id": expense_id},
        {
            "$set": {
                "items": [doc["_id"] for doc in item_docs],
                "totalAmount": total_amount,
                "updatedAt": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )


@router.post(
    "/{expense_id}/items",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an item to an expense",
)
def add_item_to_expense(
    group_id: str,
    expense_id: str,
    body: ItemCreate,
    db: Database = Depends(get_db),
) -> ItemOut:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    _require_group(db, gid)
    expense = db.expenses.find_one({"_id": eid, "groupId": gid})
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    item_doc = {
        "expenseId": eid,
        "description": body.description,
        "amount": body.amount,
    }
    result = db.items.insert_one(item_doc)
    item_doc["_id"] = result.inserted_id
    _refresh_expense_totals(db, eid)
    return item_document_to_out(item_doc)


@router.patch(
    "/{expense_id}/items/{item_id}",
    response_model=ItemOut,
    summary="Edit an item on an expense",
)
def update_expense_item(
    group_id: str,
    expense_id: str,
    item_id: str,
    body: ItemUpdate,
    db: Database = Depends(get_db),
) -> ItemOut:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    iid = parse_object_id(item_id, field="item_id")
    _require_group(db, gid)
    expense = db.expenses.find_one({"_id": eid, "groupId": gid})
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    existing = db.items.find_one({"_id": iid, "expenseId": eid})
    if existing is None:
        raise HTTPException(status_code=404, detail="Item not found")

    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_doc: dict = {}

    if "description" in patch:
        update_doc["description"] = patch["description"]
    if "amount" in patch:
        update_doc["amount"] = patch["amount"]

    after = db.items.find_one_and_update(
        {"_id": iid, "expenseId": eid},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail="Item not found")

    _refresh_expense_totals(db, eid)
    return item_document_to_out(after)


@router.delete(
    "/{expense_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Remove an item from an expense",
)
def delete_expense_item(
    group_id: str,
    expense_id: str,
    item_id: str,
    db: Database = Depends(get_db),
) -> None:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    iid = parse_object_id(item_id, field="item_id")
    _require_group(db, gid)
    expense = db.expenses.find_one({"_id": eid, "groupId": gid})
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    result = db.items.delete_one({"_id": iid, "expenseId": eid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    _refresh_expense_totals(db, eid)
