"""MongoDB indexes that enforce referential-style constraints for this app."""

from __future__ import annotations

from pymongo.database import Database


def ensure_indexes(db: Database) -> None:
    """Create indexes used for uniqueness and efficient membership lookups."""
    db.group_memberships.create_index(
        [("group_id", 1), ("user_id", 1)],
        unique=True,
        name="uniq_group_user",
    )
    db.users.create_index(
        [("email", 1)],
        unique=True,
        name="uniq_user_email",
    )
