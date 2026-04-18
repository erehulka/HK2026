"""Group debt simplification: gross IOUs from expenses → Splitwise-style simplification.

Implements the max-flow iteration described in
https://medium.com/@mithunmk93/algorithm-behind-splitwises-debt-simplification-feature-8ac485e97688
(and the referenced Java sketch): repeatedly max-flow along an unvisited arc, rebuild from
the residual graph, then add that arc with capacity equal to the max flow. Aligns with
Splitwise's rule that settlement should not introduce debtor/creditor pairs that never
existed in the gross IOU graph built from expenses.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Union

import networkx as nx
from bson import ObjectId

from app.mongo_ids import parse_object_id
from app.schemas.expense import ExpenseSplitType, read_stored_expense_amount_cents

if TYPE_CHECKING:
    from pymongo.database import Database

GroupId = Union[str, ObjectId]


def _max_flow_value_and_residual_matrix(
    cap: list[list[int]], s: int, t: int
) -> tuple[int, list[list[int]]]:
    """
    Max ``s→t`` flow on ``cap`` (euro cents), plus residual capacities as an ``n×n`` matrix.

    For each edge ``(u,v)`` with capacity ``c`` and flow ``f``: residual forward ``c−f``,
    residual reverse ``f`` (same convention as the hand-rolled Dinic step this replaced).
    """
    n = len(cap)
    G = nx.DiGraph()
    for u in range(n):
        for v in range(n):
            c = cap[u][v]
            if c > 0:
                G.add_edge(u, v, capacity=c)

    maxf, flow_dict = nx.maximum_flow(G, s, t)

    new_cap = [[0] * n for _ in range(n)]
    for u, v in G.edges():
        c = int(G.edges[u, v]["capacity"])
        f = int(flow_dict.get(u, {}).get(v, 0))
        rem = c - f
        if rem > 0:
            new_cap[u][v] += rem
        if f > 0:
            new_cap[v][u] += f

    return maxf, new_cap


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

    Only edges that already exist from expenses can appear in Splitwise-style simplification.
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


def _net_pairwise_matrix(cap: list[list[int]]) -> list[list[int]]:
    """Cancel opposite arcs between each unordered pair; non-negative entries only."""
    n = len(cap)
    out = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            net = cap[i][j] - cap[j][i]
            if net > 0:
                out[i][j] = net
            elif net < 0:
                out[j][i] = -net
    return out


def _splitwise_simplify_from_gross(gross: list[list[int]]) -> list[list[int]]:
    """
    Simplify debts per Splitwise / max-flow iteration (Mithun Mohan K, Medium, 2019).

    Repeatedly pick an unvisited arc ``(s, t)`` with positive capacity, compute max ``s→t``
    flow on the current graph, rebuild the graph from residual capacities, then add a direct
    arc ``(s, t)`` with capacity equal to that max flow. This never introduces a new creditor
    relationship beyond what residual arcs already imply; pairwise opposite debts are netted
    at the end (and once up front so circular gross IOUs start from a minimal edge set).
    """
    n = len(gross)
    cap = _net_pairwise_matrix(gross)
    visited: set[tuple[int, int]] = set()

    while True:
        pivot: tuple[int, int] | None = None
        for i in range(n):
            for j in range(n):
                if cap[i][j] > 0 and (i, j) not in visited:
                    pivot = (i, j)
                    break
            if pivot is not None:
                break
        if pivot is None:
            break

        s, t = pivot
        visited.add((s, t))

        maxf, new_cap = _max_flow_value_and_residual_matrix(cap, s, t)
        new_cap[s][t] += maxf
        cap = new_cap

    return _net_pairwise_matrix(cap)


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

    Simplification follows the max-flow iteration described for Splitwise-style debt
    simplification: net balances are preserved, and settlement only uses (and adjusts)
    money movement along directions that already existed in the gross IOU graph built from
    expenses (no brand-new debtor/creditor pairs such as ``A→C`` when only ``A→B`` and
    ``B→C`` ever appeared).

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
    matrix = _splitwise_simplify_from_gross(gross)
    return member_ids, matrix
