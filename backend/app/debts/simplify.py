"""Group debt simplification: net balances from expenses → minimal pairwise settlements."""

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


def _balances_from_even_expenses(
    expenses: list[dict],
    member_index: dict[str, int],
    n: int,
) -> list[int]:
    """Apply evenly-split expenses: each non-payer owes the payer their share (euro cents)."""
    balances = [0] * n
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
            # u owes payer `share` cents: creditor gains, debtor loses
            balances[p_idx] += share
            balances[u_idx] -= share
    return balances


def _greedy_simplify_to_matrix(balances: list[int]) -> list[list[int]]:
    """
    Same net balances, fewest-style settlement: debtors pay creditors in order.

    ``result[i][j]`` is how much ``i`` owes ``j`` (euro cents), non‑negative.
    """
    n = len(balances)
    result = [[0] * n for _ in range(n)]
    if n == 0:
        return result

    debtors: list[list[int]] = []  # [index, amount_owed_positive]
    creditors: list[list[int]] = []
    for i, b in enumerate(balances):
        if b < 0:
            debtors.append([i, -b])
        elif b > 0:
            creditors.append([i, b])

    di, ci = 0, 0
    while di < len(debtors) and ci < len(creditors):
        d_idx, d_amt = debtors[di]
        c_idx, c_amt = creditors[ci]
        pay = d_amt if d_amt < c_amt else c_amt
        result[d_idx][c_idx] += pay
        debtors[di][1] -= pay
        creditors[ci][1] -= pay
        if debtors[di][1] == 0:
            di += 1
        if creditors[ci][1] == 0:
            ci += 1

    return result


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

    Net balances are preserved; cycles collapse (e.g. A→B and B→A net to zero) and chains
    compress (e.g. A→B and B→C become at most direct flows in the greedy settlement, which
    can appear as A→C when B is used only as a pass-through in the algorithm).

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
    balances = _balances_from_even_expenses(expenses, member_index, n)
    matrix = _greedy_simplify_to_matrix(balances)
    return member_ids, matrix
