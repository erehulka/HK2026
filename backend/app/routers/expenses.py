"""HTTP routes for expenses on a group."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from app.deps import get_db
from app.mongo_ids import parse_object_id
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseDetailOut,
    ExpenseFrontendCreate,
    ExpenseOut,
    ExpenseSplitType,
    ExpenseUpdate,
    expense_document_to_detail_out,
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
    paid_by_oid = parse_object_id(body.paid_by, field="paid_by")
    _validate_membership(created_by_oid, members, field="created_by")
    _validate_membership(paid_by_oid, members, field="paid_by")
    participant_oids = [
        parse_object_id(user_id, field="participants") for user_id in body.participants
    ]
    for participant_oid in participant_oids:
        _validate_membership(participant_oid, members, field="participants")

    now = datetime.now(timezone.utc)
    expense_doc = {
        "groupId": gid,
        "description": body.description,
        "totalAmount": 0,
        "createdBy": created_by_oid,
        "paidBy": paid_by_oid,
        "participantUserIds": participant_oids,
        "splitType": body.split_type.value,
        "createdAt": now,
        "updatedAt": now,
        "items": [],
    }
    result = db.expenses.insert_one(expense_doc)
    expense_doc["_id"] = result.inserted_id
    db.groups.update_one({"_id": gid}, {"$addToSet": {"expenseIds": expense_doc["_id"]}})
    return expense_document_to_out(expense_doc)


@router.post(
    "/frontend",
    response_model=ExpenseDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an expense from the frontend payload",
)
def create_expense_from_frontend(
    group_id: str,
    body: ExpenseFrontendCreate,
    db: Database = Depends(get_db),
) -> ExpenseDetailOut:
    gid = parse_object_id(group_id, field="group_id")
    _require_group(db, gid)
    members = _member_ids(db, gid)

    paid_by_oid = parse_object_id(body.paidBy, field="paidBy")
    _validate_membership(paid_by_oid, members, field="paidBy")
    participant_oids = [
        parse_object_id(user_id, field="participantUserIds")
        for user_id in body.participantUserIds
    ]
    for participant_oid in participant_oids:
        _validate_membership(participant_oid, members, field="participantUserIds")

    now = datetime.now(timezone.utc)
    expense_doc = {
        "groupId": gid,
        "description": body.description,
        "totalAmount": 0,
        "createdBy": paid_by_oid,
        "paidBy": paid_by_oid,
        "participantUserIds": participant_oids,
        "splitType": body.splitType.value,
        "createdAt": now,
        "updatedAt": now,
        "items": [],
    }
    result = db.expenses.insert_one(expense_doc)
    expense_id = result.inserted_id

    item_docs = [
        {
            "expenseId": expense_id,
            "description": item.description,
            "amount": item.amount,
        }
        for item in body.items
    ]
    inserted_item_ids: list[ObjectId] = []
    if item_docs:
        insert_result = db.items.insert_many(item_docs)
        inserted_item_ids = list(insert_result.inserted_ids)

    total_amount = sum(item.amount for item in body.items)
    db.expenses.update_one(
        {"_id": expense_id, "groupId": gid},
        {
            "$set": {
                "items": inserted_item_ids,
                "totalAmount": total_amount,
                "updatedAt": now,
            }
        },
    )
    db.groups.update_one({"_id": gid}, {"$addToSet": {"expenseIds": expense_id}})

    expense = db.expenses.find_one({"_id": expense_id, "groupId": gid})
    items = list(db.items.find({"expenseId": expense_id}))
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense_document_to_detail_out(expense, items)


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
    expense = db.expenses.find_one({"_id": eid, "groupId": gid}, {"_id": 1})
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.items.delete_many({"expenseId": eid})
    db.expenses.delete_one({"_id": eid, "groupId": gid})
    db.groups.update_one({"_id": gid}, {"$pull": {"expenseIds": eid}})


@router.get(
    "/{expense_id}",
    response_model=ExpenseDetailOut,
    summary="Get an expense with its items",
)
def get_expense(
    group_id: str,
    expense_id: str,
    db: Database = Depends(get_db),
) -> ExpenseDetailOut:
    gid = parse_object_id(group_id, field="group_id")
    eid = parse_object_id(expense_id, field="expense_id")
    _require_group(db, gid)
    expense = db.expenses.find_one({"_id": eid, "groupId": gid})
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    items = list(db.items.find({"expenseId": eid}))
    return expense_document_to_detail_out(expense, items)


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
    now = datetime.now(timezone.utc)
    update_doc: dict = {
        "updatedAt": now,
    }
    if "description" in patch:
        update_doc["description"] = patch["description"]
    if "created_by" in patch:
        created_by_oid = parse_object_id(patch["created_by"], field="created_by")
        _validate_membership(created_by_oid, members, field="created_by")
        update_doc["createdBy"] = created_by_oid
    if "paid_by" in patch:
        paid_by_oid = parse_object_id(patch["paid_by"], field="paid_by")
        _validate_membership(paid_by_oid, members, field="paid_by")
        update_doc["paidBy"] = paid_by_oid
    if "participants" in patch:
        participant_oids = [
            parse_object_id(user_id, field="participants")
            for user_id in patch["participants"]
        ]
        for participant_oid in participant_oids:
            _validate_membership(participant_oid, members, field="participants")
        update_doc["participantUserIds"] = participant_oids
    if "split_type" in patch:
        split_type = patch["split_type"]
        update_doc["splitType"] = (
            split_type.value if isinstance(split_type, ExpenseSplitType) else split_type
        )

    result = db.expenses.update_one(
        {"_id": eid, "groupId": gid},
        {"$set": update_doc},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    after = db.expenses.find_one({"_id": eid, "groupId": gid})
    if after is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense_document_to_out(after)
