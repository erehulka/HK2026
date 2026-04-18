"""API models for group debt simplification."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class SimplifiedGroupDebtsOut(BaseModel):
    """
    Pairwise simplified debts for a group (Equal-split expenses only).

    ``member_ids`` and ``matrix`` share the same ordering: ``matrix[i][j]`` is how many
    euro cents member ``member_ids[i]`` owes member ``member_ids[j]`` (zero if no debt).
    """

    member_ids: list[str] = Field(
        ...,
        description="Group member user ids (same order as matrix rows/columns)",
    )
    matrix: list[list[int]] = Field(
        ...,
        description="Square matrix of amounts owed in euro cents; row debtor, column creditor",
    )

    @model_validator(mode="after")
    def matrix_matches_members(self) -> SimplifiedGroupDebtsOut:
        n = len(self.member_ids)
        if len(self.matrix) != n:
            msg = "matrix row count must match len(member_ids)"
            raise ValueError(msg)
        for i, row in enumerate(self.matrix):
            if len(row) != n:
                msg = f"matrix row {i} length must match len(member_ids)"
                raise ValueError(msg)
        return self
