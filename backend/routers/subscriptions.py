"""Subscription routes — replaces Firestore /subscriptions.

Stripe is still the source of truth for billing; this just mirrors a
read-only view of the active subscription for the client.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from auth import uid_from_auth, verify_bearer
from crud import get_subscription
from database import get_conn

router = APIRouter(prefix="/subscription", tags=["subscription"])


@router.get("")
def fetch(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        sub = get_subscription(conn, uid)
    return {"subscription": sub}
