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
    ExpenseSplitType,
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


def _parse_object_id_list(ids: list[str], *, field: str) -> list[ObjectId]:
    return [parse_object_id(s, field=field) for s in ids]


def _validate_expense_participants(
    participant_ids: list[ObjectId],
    payer_id: ObjectId,
    members: set[ObjectId],
) -> None:
    if not participant_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one participant is required",
        )
    if len(set(participant_ids)) != len(participant_ids):
        raise HTTPException(status_code=400, detail="Duplicate participants")
    participant_set = set(participant_ids)
    if payer_id not in participant_set:
        raise HTTPException(
            status_code=400,
            detail="paid_by_user_id must be one of participant_user_ids",
        )
    if not participant_set <= members:
        raise HTTPException(
            status_code=400,
            detail="All participants must be members of this group",
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
    participant_oids = _parse_object_id_list(
        body.participant_user_ids,
        field="participant_user_ids",
    )
    payer_oid = parse_object_id(body.paid_by_user_id, field="paid_by_user_id")
    _validate_expense_participants(participant_oids, payer_oid, members)
    now = datetime.now(timezone.utc)
    doc = {
        "group_id": gid,
        "amount": body.amount,
        "participant_user_ids": participant_oids,
        "paid_by_user_id": payer_oid,
        "type": body.type.value,
        "items": body.items,
        "created_at": now,
        "updated_at": now,
    }
    result = db.expenses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return expense_document_to_out(doc)


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
    res = db.expenses.delete_one({"_id": eid, "group_id": gid})
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
    existing = db.expenses.find_one({"_id": eid, "group_id": gid})
    if existing is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    members = _member_ids(db, gid)
    participant_oids = (
        _parse_object_id_list(body.participant_user_ids, field="participant_user_ids")
        if body.participant_user_ids is not None
        else list(existing["participant_user_ids"])
    )
    payer_oid = (
        parse_object_id(body.paid_by_user_id, field="paid_by_user_id")
        if body.paid_by_user_id is not None
        else existing["paid_by_user_id"]
    )
    _validate_expense_participants(participant_oids, payer_oid, members)

    now = datetime.now(timezone.utc)
    update_doc: dict = {"updated_at": now}
    if "amount" in patch:
        update_doc["amount"] = patch["amount"]
    if "participant_user_ids" in patch:
        update_doc["participant_user_ids"] = participant_oids
    if "paid_by_user_id" in patch:
        update_doc["paid_by_user_id"] = payer_oid
    if "type" in patch:
        t = patch["type"]
        update_doc["type"] = t.value if isinstance(t, ExpenseSplitType) else t
    if "items" in patch:
        update_doc["items"] = patch["items"]

    after = db.expenses.find_one_and_update(
        {"_id": eid, "group_id": gid},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense_document_to_out(after)
