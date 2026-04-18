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


def _validate_item_payload(
    item: ItemCreate,
    members: set[ObjectId],
) -> tuple[ObjectId, ObjectId, list[dict]]:
    paid_by_oid = parse_object_id(item.paid_by, field="paid_by")
    created_by_oid = parse_object_id(item.created_by, field="created_by")
    _validate_membership(paid_by_oid, members, field="paid_by")
    _validate_membership(created_by_oid, members, field="created_by")

    shares: list[dict] = []
    share_total = 0
    for share in item.shares:
        uid = parse_object_id(share.user_id, field="shares.user_id")
        _validate_membership(uid, members, field="shares.user_id")
        shares.append({"userId": uid, "amount": share.amount})
        share_total += share.amount

    if share_total != item.amount:
        raise HTTPException(
            status_code=400,
            detail="item share amounts must sum to item amount",
        )
    return paid_by_oid, created_by_oid, shares


def _participant_ids_from_items(item_docs: list[dict]) -> list[ObjectId]:
    """Build a stable unique participant list from item shares and payers."""
    seen: set[ObjectId] = set()
    ordered: list[ObjectId] = []
    for item in item_docs:
        paid_by = item["paidBy"]
        if paid_by not in seen:
            seen.add(paid_by)
            ordered.append(paid_by)
        for share in item["shares"]:
            uid = share["userId"]
            if uid not in seen:
                seen.add(uid)
                ordered.append(uid)
    return ordered


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
    """Refresh stored totals and participants from the item's current state."""
    item_docs = list(db.items.find({"expenseId": expense_id}))
    participant_oids = _participant_ids_from_items(item_docs)
    total_amount = _total_amount_from_items(item_docs)
    now = datetime.now(timezone.utc)
    return db.expenses.find_one_and_update(
        {"_id": expense_id},
        {
            "$set": {
                "items": [doc["_id"] for doc in item_docs],
                "participantUserIds": participant_oids,
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

    members = _member_ids(db, gid)
    paid_by_oid, item_created_by_oid, shares = _validate_item_payload(body, members)
    now = datetime.now(timezone.utc)
    item_doc = {
        "expenseId": eid,
        "description": body.description,
        "amount": body.amount,
        "shares": shares,
        "paidBy": paid_by_oid,
        "createdBy": item_created_by_oid,
        "createdAt": now,
        "updatedAt": now,
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

    members = _member_ids(db, gid)
    update_doc: dict = {"updatedAt": datetime.now(timezone.utc)}

    if "description" in patch:
        update_doc["description"] = patch["description"]
    if "amount" in patch:
        update_doc["amount"] = patch["amount"]
    if "paid_by" in patch:
        paid_by_oid = parse_object_id(patch["paid_by"], field="paid_by")
        _validate_membership(paid_by_oid, members, field="paid_by")
        update_doc["paidBy"] = paid_by_oid
    if "created_by" in patch:
        created_by_oid = parse_object_id(patch["created_by"], field="created_by")
        _validate_membership(created_by_oid, members, field="created_by")
        update_doc["createdBy"] = created_by_oid
    if "shares" in patch:
        shares_payload = body.shares or []
        if not shares_payload:
            raise HTTPException(status_code=400, detail="shares cannot be empty")
        shares: list[dict] = []
        share_total = 0
        for share in shares_payload:
            uid = parse_object_id(share.user_id, field="shares.user_id")
            _validate_membership(uid, members, field="shares.user_id")
            shares.append({"userId": uid, "amount": share.amount})
            share_total += share.amount
        amount = patch.get("amount", existing["amount"])
        if share_total != amount:
            raise HTTPException(
                status_code=400,
                detail="item share amounts must sum to item amount",
            )
        update_doc["shares"] = shares

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
