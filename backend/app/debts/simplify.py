"""Group debt simplification: gross IOUs from expenses.

After aggregating Equal-split expenses into a gross IOU matrix, we **simplify** to a smaller
set of directed debts by matching largest net debtors to largest net creditors first. This
preserves each member's net balance and can introduce a direct arc between two
people who never shared an expense edge (e.g. ``A→C`` when expenses only implied ``A→B`` and
``B→C``).
"""

from __future__ import annotations

import heapq
from typing import TYPE_CHECKING, Union

from bson import ObjectId

from app.mongo_ids import parse_object_id
from app.schemas.expense import ExpenseSplitType, _mongo_list, _mongo_value, read_stored_expense_amount_cents
from app.schemas.item import _amount_from_mongo

if TYPE_CHECKING:
    from pymongo.database import Database

GroupId = Union[str, ObjectId]


def _expense_total_amount_cents(doc: dict) -> int:
    """Total in euro cents: tests use ``amount``; persisted expenses use ``totalAmount``."""
    if "amount" in doc:
        return read_stored_expense_amount_cents(doc["amount"])
    raw = _mongo_value(doc, snake_key="total_amount", camel_key="totalAmount")
    return _amount_from_mongo(raw, field="total_amount")


def _split_type_from_expense_doc(doc: dict) -> ExpenseSplitType:
    """Resolve split type from Mongo ``splitType`` / ``split_type``, else optional legacy ``type``."""
    raw: object | None = None
    if "split_type" in doc or "splitType" in doc:
        raw = _mongo_value(doc, snake_key="split_type", camel_key="splitType")
    if raw is None:
        raw = doc.get("type")
    if raw is None:
        return ExpenseSplitType.EQUAL
    if isinstance(raw, ExpenseSplitType):
        return raw
    if isinstance(raw, str):
        n = raw.strip().lower()
        if n == ExpenseSplitType.EQUAL.value.lower() or n == "equal":
            return ExpenseSplitType.EQUAL
        if n == ExpenseSplitType.SHARES.value.lower() or n == "shares":
            return ExpenseSplitType.SHARES
    try:
        return ExpenseSplitType(raw)
    except ValueError:
        msg = f"Unsupported expense split type: {raw!r}"
        raise ValueError(msg) from None


def _equal_shares_cents(total_cents: int, n: int) -> list[int]:
    """Split ``total_cents`` across ``n`` people in whole cents (remainder to lower indices)."""
    if n <= 0:
        msg = "n must be positive"
        raise ValueError(msg)
    base, rem = divmod(total_cents, n)
    return [base + (1 if i < rem else 0) for i in range(n)]


def _gross_matrix_from_even_expenses(
    expenses: list[dict],
    member_index: dict[str, int],
    n: int,
) -> list[list[int]]:
    """
    Directed IOUs from Equal-split expenses: ``gross[i][j]`` is cents member ``i`` owes ``j``.
    """
    gross = [[0] * n for _ in range(n)]
    for doc in expenses:
        split = _split_type_from_expense_doc(doc)
        if split != ExpenseSplitType.EQUAL:
            msg = f"Unsupported expense split type: {split.value!r}"
            raise ValueError(msg)
        total = _expense_total_amount_cents(doc)
        participants: list = list(
            _mongo_list(doc, snake_key="participant_user_ids", camel_key="participantUserIds")
        )
        payer_oid = (
            doc["paid_by_user_id"]
            if "paid_by_user_id" in doc
            else _mongo_value(doc, snake_key="paid_by", camel_key="paidBy")
        )
        payer_id = str(payer_oid)
        if payer_id not in member_index:
            msg = f"Payer {payer_id} is not a member of this group"
            raise ValueError(msg)
        p_idx = member_index[payer_id]
        shares = _equal_shares_cents(total, len(participants))
        for k, uid in enumerate(participants):
            uid_str = str(uid)
            if uid_str not in member_index:
                msg = f"Participant {uid_str} is not a member of this group"
                raise ValueError(msg)
            share = shares[k]
            u_idx = member_index[uid_str]
            if u_idx == p_idx:
                continue
            gross[u_idx][p_idx] += share
    return gross


def _balances_from_even_expenses(
    expenses: list[dict],
    member_index: dict[str, int],
    n: int,
) -> list[int]:
    """Apply Equal-split expenses: each non-payer owes the payer their share (euro cents)."""
    gross = _gross_matrix_from_even_expenses(expenses, member_index, n)
    return _balances_from_gross_matrix(gross)


def _balances_from_gross_matrix(gross: list[list[int]]) -> list[int]:
    """Net balance from gross IOUs: inflow minus outflow (same sign as expense aggregation)."""
    n = len(gross)
    balances = [0] * n
    for i in range(n):
        for j in range(n):
            balances[i] += gross[j][i] - gross[i][j]
    return balances


def _simplify_from_gross(gross: list[list[int]]) -> list[list[int]]:
    """
    Reduce debts to a **net-balance** settlement: every net debtor pays net creditors so that
    per-person inflow minus outflow matches the gross IOU aggregate.

    Members with zero net balance have no incident arcs. Settlement greedily matches the
    largest net debtor and largest net creditor at each step (Splitwise-style netting); ties
    break by ascending member index.
    """
    n = len(gross)
    balances = _balances_from_gross_matrix(gross)
    if all(b == 0 for b in balances):
        return [[0] * n for _ in range(n)]

    debtor_min_heap = [(balances[i], i) for i in range(n) if balances[i] < 0]
    creditor_min_heap = [(-balances[i], i) for i in range(n) if balances[i] > 0]
    heapq.heapify(debtor_min_heap)
    heapq.heapify(creditor_min_heap)

    matrix = [[0] * n for _ in range(n)]
    while debtor_min_heap and creditor_min_heap:
        d_amt_neg, d_i = heapq.heappop(debtor_min_heap)
        c_amt_neg, c_i = heapq.heappop(creditor_min_heap)
        d_amt = -d_amt_neg
        c_amt = -c_amt_neg
        x = min(d_amt, c_amt)
        matrix[d_i][c_i] += x
        d_rem = d_amt - x
        c_rem = c_amt - x
        if d_rem > 0:
            heapq.heappush(debtor_min_heap, (-d_rem, d_i))
        if c_rem > 0:
            heapq.heappush(creditor_min_heap, (-c_rem, c_i))

    return matrix


def simplified_debt_matrix_cents(
    group_id: GroupId,
    db: "Database",
) -> tuple[list[str], list[list[int]]]:
    """
    For a group, compute **simplified** pairwise debts from all **Equal** split expenses.

    Returns ``(member_ids, matrix)`` where:

    - ``member_ids`` lists every current group member (Mongo user id strings), sorted
      lexicographically for a stable row/column order.
    - ``matrix[i][j]`` is how many **euro cents** member ``i`` owes member ``j`` (0 if no debt).

    Simplification matches net debtors to net creditors while preserving each member's net
    balance from the expense aggregate. Direct ``i→j`` debts may appear even when no single
    expense had ``i`` owing ``j``.

    Raises:
        ValueError: unknown expense type, or a participant/payer not in the group.
    """
    gid = (
        parse_object_id(group_id, field="group_id")
        if isinstance(group_id, str)
        else group_id
    )
    if db.groups.find_one({"_id": gid}) is None:
        msg = "Group not found"
        raise ValueError(msg)

    member_ids = sorted(
        str(doc["user_id"])
        for doc in db.group_memberships.find({"group_id": gid}, {"user_id": 1})
    )
    n = len(member_ids)
    member_index = {uid: i for i, uid in enumerate(member_ids)}

    expenses = list(db.expenses.find({"$or": [{"group_id": gid}, {"groupId": gid}]}))
    gross = _gross_matrix_from_even_expenses(expenses, member_index, n)
    matrix = _simplify_from_gross(gross)
    return member_ids, matrix
