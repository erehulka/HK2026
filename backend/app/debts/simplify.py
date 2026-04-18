"""Group debt simplification: gross IOUs from expenses.

After aggregating evenly-split expenses into a gross IOU matrix, we **simplify** to a smaller
set of directed debts by matching net debtors to net creditors (greedy by ascending member
index). This preserves each member's net balance and can introduce a direct arc between two
people who never shared an expense edge (e.g. ``A→C`` when expenses only implied ``A→B`` and
``B→C``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Union

from bson import ObjectId

from app.mongo_ids import parse_object_id
from app.schemas.expense import ExpenseSplitType, read_stored_expense_amount_cents

if TYPE_CHECKING:
    from pymongo.database import Database

GroupId = Union[str, ObjectId]


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
    Directed IOUs from evenly-split expenses: ``gross[i][j]`` is cents member ``i`` owes ``j``.
    """
    gross = [[0] * n for _ in range(n)]
    for doc in expenses:
        if doc.get("type") != ExpenseSplitType.EVENLY.value:
            msg = f"Unsupported expense split type: {doc.get('type')!r}"
            raise ValueError(msg)
        total = read_stored_expense_amount_cents(doc["amount"])
        participants: list = list(doc["participant_user_ids"])
        payer_oid = doc["paid_by_user_id"]
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
    """Apply evenly-split expenses: each non-payer owes the payer their share (euro cents)."""
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

    Members with zero net balance have no incident arcs. Pairs are matched greedily in
    ascending member index order among debtors and among creditors (deterministic, at most
    one arc per debtor–creditor pair).
    """
    n = len(gross)
    balances = _balances_from_gross_matrix(gross)
    if all(b == 0 for b in balances):
        return [[0] * n for _ in range(n)]

    debtors = [[i, -balances[i]] for i in range(n) if balances[i] < 0]
    creditors = [[i, balances[i]] for i in range(n) if balances[i] > 0]
    debtors.sort(key=lambda t: t[0])
    creditors.sort(key=lambda t: t[0])

    matrix = [[0] * n for _ in range(n)]
    di = ci = 0
    while di < len(debtors) and ci < len(creditors):
        d_i, d_amt = debtors[di]
        c_i, c_amt = creditors[ci]
        x = min(d_amt, c_amt)
        matrix[d_i][c_i] += x
        debtors[di][1] = d_amt - x
        creditors[ci][1] = c_amt - x
        if debtors[di][1] == 0:
            di += 1
        if creditors[ci][1] == 0:
            ci += 1

    return matrix


def simplified_debt_matrix_cents(
    group_id: GroupId,
    db: "Database",
) -> tuple[list[str], list[list[int]]]:
    """
    For a group, compute **simplified** pairwise debts from all **evenly** split expenses.

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

    expenses = list(db.expenses.find({"group_id": gid}))
    gross = _gross_matrix_from_even_expenses(expenses, member_index, n)
    matrix = _simplify_from_gross(gross)
    return member_ids, matrix
