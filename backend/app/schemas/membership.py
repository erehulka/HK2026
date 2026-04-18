"""Models for group–user membership edges (many-to-many link)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GroupMembershipOut(BaseModel):
    """A membership row linking one user to one group."""

    group_id: str
    user_id: str
    created_at: datetime
