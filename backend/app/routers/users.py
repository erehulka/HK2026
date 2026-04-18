"""HTTP routes for users and listing their group memberships."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.deps import get_db
from app.mongo_ids import parse_object_id
from app.schemas.group import GroupOut, group_document_to_out
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.post(
    "/",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
)
def create_user(body: UserCreate, db: Database = Depends(get_db)) -> UserOut:
    created_at = datetime.now(timezone.utc)
    doc = {
        "display_name": body.display_name,
        "email": body.email,
        "created_at": created_at,
    }
    try:
        result = db.users.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists",
        ) from exc
    return UserOut(
        id=str(result.inserted_id),
        display_name=body.display_name,
        email=body.email,
        created_at=created_at,
    )


@router.get(
    "/{user_id}/groups",
    response_model=list[GroupOut],
    summary="List groups a user belongs to",
)
def list_user_groups(user_id: str, db: Database = Depends(get_db)) -> list[GroupOut]:
    uid = parse_object_id(user_id, field="user_id")
    if db.users.find_one({"_id": uid}) is None:
        raise HTTPException(status_code=404, detail="User not found")
    cursor = db.group_memberships.find({"user_id": uid})
    group_ids = [doc["group_id"] for doc in cursor]
    if not group_ids:
        return []
    groups = list(db.groups.find({"_id": {"$in": group_ids}}))
    by_id = {doc["_id"]: doc for doc in groups}
    ordered = [by_id[gid] for gid in group_ids if gid in by_id]
    return [group_document_to_out(d) for d in ordered]
