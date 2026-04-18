"""HTTP routes for groups and group membership stored in MongoDB."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.deps import get_db
from app.mongo_ids import parse_object_id
from app.schemas.expense import expense_document_to_out
from app.schemas.group import GroupCreate, GroupDetailOut, GroupOut, group_document_to_detail_out
from app.schemas.membership import GroupMembershipOut
from app.schemas.user import UserOut, user_document_to_out

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post(
    "/",
    response_model=GroupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a group",
)
def create_group(body: GroupCreate, db: Database = Depends(get_db)) -> GroupOut:
    created_at = datetime.now(timezone.utc)
    doc = {
        "name": body.name,
        "description": body.description,
        "created_at": created_at,
        "expenseIds": [],
    }
    result = db.groups.insert_one(doc)
    return GroupOut(
        id=str(result.inserted_id),
        name=body.name,
        description=body.description,
        created_at=created_at,
    )


@router.get(
    "/{group_id}",
    response_model=GroupDetailOut,
    summary="Get a group with its expenses",
)
def get_group(group_id: str, db: Database = Depends(get_db)) -> GroupDetailOut:
    gid = parse_object_id(group_id, field="group_id")
    group = db.groups.find_one({"_id": gid})
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    expense_ids = group.get("expenseIds", [])
    expenses = list(db.expenses.find({"_id": {"$in": expense_ids}})) if expense_ids else []
    by_id = {expense["_id"]: expense for expense in expenses}
    ordered = [by_id[expense_id] for expense_id in expense_ids if expense_id in by_id]
    return group_document_to_detail_out(group, ordered)


@router.get(
    "/{group_id}/users",
    response_model=list[UserOut],
    summary="List users in a group",
)
def list_group_users(group_id: str, db: Database = Depends(get_db)) -> list[UserOut]:
    gid = parse_object_id(group_id, field="group_id")
    if db.groups.find_one({"_id": gid}) is None:
        raise HTTPException(status_code=404, detail="Group not found")
    cursor = db.group_memberships.find({"group_id": gid})
    user_ids = [doc["user_id"] for doc in cursor]
    if not user_ids:
        return []
    users = list(db.users.find({"_id": {"$in": user_ids}}))
    by_id = {doc["_id"]: doc for doc in users}
    ordered = [by_id[uid] for uid in user_ids if uid in by_id]
    return [user_document_to_out(d) for d in ordered]


@router.post(
    "/{group_id}/users/{user_id}",
    response_model=GroupMembershipOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a user to a group",
)
def add_user_to_group(
    group_id: str,
    user_id: str,
    db: Database = Depends(get_db),
) -> GroupMembershipOut:
    gid = parse_object_id(group_id, field="group_id")
    uid = parse_object_id(user_id, field="user_id")
    if db.groups.find_one({"_id": gid}) is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if db.users.find_one({"_id": uid}) is None:
        raise HTTPException(status_code=404, detail="User not found")
    created_at = datetime.now(timezone.utc)
    doc = {"group_id": gid, "user_id": uid, "created_at": created_at}
    try:
        db.group_memberships.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this group",
        ) from exc
    return GroupMembershipOut(
        group_id=str(gid),
        user_id=str(uid),
        created_at=created_at,
    )


@router.delete(
    "/{group_id}/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Remove a user from a group",
)
def remove_user_from_group(
    group_id: str,
    user_id: str,
    db: Database = Depends(get_db),
) -> None:
    gid = parse_object_id(group_id, field="group_id")
    uid = parse_object_id(user_id, field="user_id")
    result = db.group_memberships.delete_one({"group_id": gid, "user_id": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
