"""Tests for ``app.debts.simplify`` (equal-split gross IOUs + Splitwise-style max-flow simplification)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterator

import pytest
from bson import ObjectId

from app.debts.simplify import (
    _balances_from_even_expenses,
    _balances_from_gross_matrix,
    _equal_shares_cents,
    _gross_matrix_from_even_expenses,
    _splitwise_simplify_from_gross,
    simplified_debt_matrix_cents,
)


@dataclass
class _FakeCollection:
    """Minimal collection surface used by ``simplified_debt_matrix_cents``."""

    find_one_result: Any = None
    find_rows: list[dict] = field(default_factory=list)
    find_key: str = "group_id"

    def find_one(self, query: dict) -> Any:
        return self.find_one_result

    def find(self, query: dict, projection: Any = None) -> Iterator[dict]:
        key = query[self.find_key]
        for row in self.find_rows:
            if row.get(self.find_key) == key:
                yield row


@dataclass
class FakeDatabase:
    """In-memory stand-in for the subset of ``Database`` used by debt simplification."""

    group_id: ObjectId
    group_exists: bool = True
    member_user_ids: list[ObjectId] = field(default_factory=list)
    expense_docs: list[dict] = field(default_factory=list)

    def __post_init__(self) -> None:
        gid = self.group_id
        self.groups = _FakeCollection(
            find_one_result={"_id": gid} if self.group_exists else None,
            find_rows=[],
            find_key="group_id",
        )
        self.group_memberships = _FakeCollection(
            find_one_result=None,
            find_rows=[{"group_id": gid, "user_id": u} for u in self.member_user_ids],
            find_key="group_id",
        )
        rows = []
        for doc in self.expense_docs:
            row = dict(doc)
            row.setdefault("group_id", gid)
            rows.append(row)
        self.expenses = _FakeCollection(find_one_result=None, find_rows=rows, find_key="group_id")


def _sorted_member_index(member_oids: list[ObjectId]) -> dict[str, int]:
    ids = sorted(str(x) for x in member_oids)
    return {s: i for i, s in enumerate(ids)}


def test_equal_shares_cents_splits_remainder_on_low_indices() -> None:
    assert _equal_shares_cents(10, 3) == [4, 3, 3]
    assert sum(_equal_shares_cents(10, 3)) == 10
    assert _equal_shares_cents(100, 1) == [100]
    assert _equal_shares_cents(5, 2) == [3, 2]


def test_equal_shares_cents_rejects_nonpositive_n() -> None:
    with pytest.raises(ValueError, match="n must be positive"):
        _equal_shares_cents(10, 0)


def test_splitwise_chain_keeps_only_existing_edges() -> None:
    """A→B and B→C in gross graph: simplification does not introduce A→C."""
    A, B, C = ObjectId(), ObjectId(), ObjectId()
    mi = _sorted_member_index([A, B, C])
    expenses = [
        {
            "type": "evenly",
            "amount": 20,
            "participant_user_ids": [A, B],
            "paid_by_user_id": B,
        },
        {
            "type": "evenly",
            "amount": 20,
            "participant_user_ids": [B, C],
            "paid_by_user_id": C,
        },
    ]
    gross = _gross_matrix_from_even_expenses(expenses, mi, 3)
    bal = _balances_from_gross_matrix(gross)
    mat = _splitwise_simplify_from_gross(gross)
    ia, ib, ic = mi[str(A)], mi[str(B)], mi[str(C)]
    assert bal[ia] == -10 and bal[ic] == 10 and bal[ib] == 0
    assert mat[ia][ib] == 10 and mat[ib][ic] == 10
    assert mat[ia][ic] == 0
    assert sum(sum(row) for row in mat) == 20


def test_balances_mutual_expenses_net_to_zero_matrix() -> None:
    """Opposite pairwise reimbursements cancel: no one owes anyone."""
    A, C = ObjectId(), ObjectId()
    mi = _sorted_member_index([A, C])
    expenses = [
        {
            "type": "evenly",
            "amount": 20,
            "participant_user_ids": [A, C],
            "paid_by_user_id": C,
        },
        {
            "type": "evenly",
            "amount": 20,
            "participant_user_ids": [A, C],
            "paid_by_user_id": A,
        },
    ]
    gross = _gross_matrix_from_even_expenses(expenses, mi, 2)
    bal = _balances_from_gross_matrix(gross)
    mat = _splitwise_simplify_from_gross(gross)
    assert bal == [0, 0]
    assert mat == [[0, 0], [0, 0]]


def test_balances_rejects_unknown_split_type() -> None:
    A = ObjectId()
    mi = _sorted_member_index([A])
    with pytest.raises(ValueError, match="Unsupported expense split type"):
        _balances_from_even_expenses(
            [{"type": "custom", "amount": 10, "participant_user_ids": [A], "paid_by_user_id": A}],
            mi,
            1,
        )


def test_balances_rejects_participant_not_in_group() -> None:
    A, B = ObjectId(), ObjectId()
    mi = _sorted_member_index([A])  # B not a member
    with pytest.raises(ValueError, match="not a member"):
        _balances_from_even_expenses(
            [
                {
                    "type": "evenly",
                    "amount": 20,
                    "participant_user_ids": [A, B],
                    "paid_by_user_id": A,
                }
            ],
            mi,
            1,
        )


def test_simplified_debt_matrix_cents_integration() -> None:
    gid = ObjectId()
    A, B, C = ObjectId(), ObjectId(), ObjectId()
    db = FakeDatabase(
        group_id=gid,
        member_user_ids=[A, B, C],
        expense_docs=[
            {
                "type": "evenly",
                "amount": 20,
                "participant_user_ids": [A, B],
                "paid_by_user_id": B,
            },
            {
                "type": "evenly",
                "amount": 20,
                "participant_user_ids": [B, C],
                "paid_by_user_id": C,
            },
        ],
    )
    member_ids, matrix = simplified_debt_matrix_cents(str(gid), db)
    assert member_ids == sorted([str(A), str(B), str(C)])
    ia, ib, ic = member_ids.index(str(A)), member_ids.index(str(B)), member_ids.index(str(C))
    assert matrix[ia][ib] == 10 and matrix[ib][ic] == 10
    assert matrix[ia][ic] == 0
    assert sum(sum(row) for row in matrix) == 20


def test_simplified_debt_matrix_raises_when_group_missing() -> None:
    gid = ObjectId()
    db = FakeDatabase(group_id=gid, group_exists=False, member_user_ids=[ObjectId()])
    with pytest.raises(ValueError, match="Group not found"):
        simplified_debt_matrix_cents(str(gid), db)


def test_splitwise_matrix_preserves_net_balances_from_gross() -> None:
    gross = [
        [0, 3, 4],
        [0, 0, 0],
        [0, 0, 0],
    ]
    want = _balances_from_gross_matrix(gross)
    mat = _splitwise_simplify_from_gross(gross)
    n = len(want)
    for i in range(n):
        incoming = sum(mat[j][i] for j in range(n))
        outgoing = sum(mat[i][j] for j in range(n))
        assert incoming - outgoing == want[i]
