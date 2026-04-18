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

    paid_by_oid = parse_object_id(body.paid_by, field="paid_by")
    _validate_membership(paid_by_oid, members, field="paid_by")
    participant_oids = [
        parse_object_id(user_id, field="participant_user_ids")
        for user_id in body.participant_user_ids
    ]
    for participant_oid in participant_oids:
        _validate_membership(participant_oid, members, field="participant_user_ids")

    now = datetime.now(timezone.utc)
    expense_doc = {
        "groupId": gid,
        "description": body.description,
        "totalAmount": 0,
        "createdBy": paid_by_oid,
        "paidBy": paid_by_oid,
        "participantUserIds": participant_oids,
        "splitType": body.split_type.value,
        "createdAt": now,
        "updatedAt": now,
        "items": [],
    }

    expense_id: ObjectId | None = None
    inserted_item_ids: list[ObjectId] = []
    try:
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
        if item_docs:
            insert_result = db.items.insert_many(item_docs)
            inserted_item_ids = list(insert_result.inserted_ids)

        total_amount = sum(item.amount for item in body.items)
        expense_update_result = db.expenses.update_one(
            {"_id": expense_id, "groupId": gid},
            {
                "$set": {
                    "items": inserted_item_ids,
                    "totalAmount": total_amount,
                    "updatedAt": now,
                }
            },
        )
        if expense_update_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Expense not found")

        group_update_result = db.groups.update_one(
            {"_id": gid},
            {"$addToSet": {"expenseIds": expense_id}},
        )
        if group_update_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Group not found")

        expense = db.expenses.find_one({"_id": expense_id, "groupId": gid})
        items = list(db.items.find({"expenseId": expense_id}))
        if expense is None:
            raise HTTPException(status_code=404, detail="Expense not found")
        return expense_document_to_detail_out(expense, items)
    except Exception:
        if expense_id is not None:
            try:
                if inserted_item_ids:
                    db.items.delete_many({"_id": {"$in": inserted_item_ids}})
                else:
                    db.items.delete_many({"expenseId": expense_id})
                db.expenses.delete_one({"_id": expense_id, "groupId": gid})
                db.groups.update_one({"_id": gid}, {"$pull": {"expenseIds": expense_id}})
            except Exception:
                pass
        raise
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
    patch_items = patch.pop("items", None)
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

    if patch_items is not None:
        existing_item_ids: list[ObjectId] = []
        seen_item_ids: set[ObjectId] = set()
        retained_item_ids: list[ObjectId] = []
        normalized_items: list[tuple[ObjectId | None, dict[str, int | str]]] = []

        for item_patch in patch_items:
            item_id = item_patch.get("id")
            normalized_iid: ObjectId | None = None
            if item_id:
                iid = parse_object_id(item_id, field="items.id")
                if iid not in seen_item_ids:
                    seen_item_ids.add(iid)
                    existing_item_ids.append(iid)
                    normalized_iid = iid

            normalized_items.append(
                (
                    normalized_iid,
                    {
                        "description": item_patch["description"],
                        "amount": item_patch["amount"],
                    },
                )
            )

        if existing_item_ids:
            existing_count = db.items.count_documents(
                {
                    "_id": {"$in": existing_item_ids},
                    "expenseId": eid,
                }
            )
            if existing_count != len(existing_item_ids):
                raise HTTPException(
                    status_code=404,
                    detail="One or more items were not found on this expense",
                )

        for item_id, item_set in normalized_items:
            if item_id is not None:
                db.items.update_one(
                    {"_id": item_id, "expenseId": eid},
                    {"$set": item_set},
                )
                retained_item_ids.append(item_id)
            else:
                insert_result = db.items.insert_one({
                    "expenseId": eid,
                    **item_set,
                })
                retained_item_ids.append(insert_result.inserted_id)

        if retained_item_ids:
            db.items.delete_many(
                {
                    "expenseId": eid,
                    "_id": {"$nin": retained_item_ids},
                }
            )
        else:
            db.items.delete_many({"expenseId": eid})

        item_docs = list(db.items.find({"expenseId": eid}, {"_id": 1, "amount": 1}))
        total_amount = 0
        for item_doc in item_docs:
            amount = item_doc["amount"]
            if not isinstance(amount, int) or isinstance(amount, bool):
                raise HTTPException(
                    status_code=500,
                    detail="Stored item amount must be an integer",
                )
            total_amount += amount

        update_doc["items"] = [item_doc["_id"] for item_doc in item_docs]
        update_doc["totalAmount"] = total_amount

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
