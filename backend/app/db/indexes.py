"""MongoDB indexes that enforce referential-style constraints for this app."""

from __future__ import annotations

from pymongo.database import Database


def _ensure_expenses_by_group_index(db: Database) -> None:
    """Ensure `expenses_by_group` targets `group_id`."""
    expected_key = [("group_id", 1)]
    existing = db.expenses.index_information().get("expenses_by_group")
    if existing and existing.get("key") != expected_key:
        db.expenses.drop_index("expenses_by_group")
    db.expenses.create_index(expected_key, name="expenses_by_group")


def _ensure_items_by_expense_index(db: Database) -> None:
    """Ensure `items_by_expense` targets `expense_id`."""
    expected_key = [("expense_id", 1)]
    existing = db.items.index_information().get("items_by_expense")
    if existing and existing.get("key") != expected_key:
        db.items.drop_index("items_by_expense")
    db.items.create_index(expected_key, name="items_by_expense")


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
    _ensure_items_by_expense_index(db)
