"""MongoDB indexes that enforce referential-style constraints for this app."""

from __future__ import annotations

from pymongo.database import Database


def _ensure_expenses_by_group_index(db: Database) -> None:
    """Ensure `expenses_by_group` targets `groupId` (migrates legacy `group_id`)."""
    expected_key = [("groupId", 1)]
    existing = db.expenses.index_information().get("expenses_by_group")
    if existing and existing.get("key") != expected_key:
        db.expenses.drop_index("expenses_by_group")
    db.expenses.create_index(expected_key, name="expenses_by_group")


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
    _ensure_expenses_by_group_index(db)
    db.items.create_index(
        [("expenseId", 1)],
        name="items_by_expense",
    )
