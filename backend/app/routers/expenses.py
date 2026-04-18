"""HTTP routes for expenses on a group."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database

from app.deps import get_db
from app.mongo_ids import parse_object_id
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseOut,
    ItemCreate,
    ExpenseUpdate,
    expense_document_to_out,
)

router = APIRouter(
    prefix="/groups/{group_id}/expenses",
    tags=["expenses"],
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
    return sum(int(item["amount"]) for item in item_docs)


@router.post(
    "/",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an expense to a group",
)
def create_expense(
    group_id: str,
    body: ExpenseCreate,
    db: Database = Depends(get_db),
) -> ExpenseOut:
    gid = parse_object_id(group_id, field="group_id")
    _require_group(db, gid)
    members = _member_ids(db, gid)
    created_by_oid = parse_object_id(body.created_by, field="created_by")
    _validate_membership(created_by_oid, members, field="created_by")

    item_docs: list[dict] = []
    for item in body.items:
        paid_by_oid, item_created_by_oid, shares = _validate_item_payload(item, members)
        item_docs.append(
            {
                "description": item.description,
                "amount": item.amount,
                "shares": shares,
                "paidBy": paid_by_oid,
                "createdBy": item_created_by_oid,
            }
        )
    items_total = _total_amount_from_items(item_docs)
    participant_oids = _participant_ids_from_items(item_docs)

    now = datetime.now(timezone.utc)
    expense_doc = {
        "groupId": gid,
        "description": body.description,
        "totalAmount": items_total,
        "createdBy": created_by_oid,
        "participantUserIds": participant_oids,
        "createdAt": now,
        "updatedAt": now,
        "items": [],
    }
    result = db.expenses.insert_one(expense_doc)
    expense_id = result.inserted_id
    expense_doc["_id"] = expense_id

    if item_docs:
        for item_doc in item_docs:
            item_doc["expenseId"] = expense_id
            item_doc["createdAt"] = now
            item_doc["updatedAt"] = now
        insert_res = db.items.insert_many(item_docs)
        item_ids = insert_res.inserted_ids
        db.expenses.update_one(
            {"_id": expense_id},
            {"$set": {"items": item_ids, "updatedAt": now}},
        )
        expense_doc["items"] = item_ids

    return expense_document_to_out(expense_doc)


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Remove an expense from a group",
)
def delete_expense(
    group_id: str,
    expense_id: str,
    db: Database = Depends(get_db),
) -> None:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    _require_group(db, gid)
    db.items.delete_many({"expenseId": eid})
    res = db.expenses.delete_one({"_id": eid, "groupId": gid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")


@router.patch(
    "/{expense_id}",
    response_model=ExpenseOut,
    summary="Edit an expense",
)
def update_expense(
    group_id: str,
    expense_id: str,
    body: ExpenseUpdate,
    db: Database = Depends(get_db),
) -> ExpenseOut:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    _require_group(db, gid)
    existing = db.expenses.find_one({"_id": eid, "groupId": gid})
    if existing is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    members = _member_ids(db, gid)
    existing_items = list(db.items.find({"expenseId": eid}))
    participant_oids = _participant_ids_from_items(existing_items)
    items_total = _total_amount_from_items(existing_items)

    now = datetime.now(timezone.utc)
    update_doc: dict = {
        "updatedAt": now,
        "participantUserIds": participant_oids,
        "totalAmount": items_total,
    }
    if "description" in patch:
        update_doc["description"] = patch["description"]
    if "created_by" in patch:
        created_by_oid = parse_object_id(patch["created_by"], field="created_by")
        _validate_membership(created_by_oid, members, field="created_by")
        update_doc["createdBy"] = created_by_oid

    after = db.expenses.find_one_and_update(
        {"_id": eid, "groupId": gid},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense_document_to_out(after)
