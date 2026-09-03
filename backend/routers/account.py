"""Account GDPR routes — replaces Firestore-admin account/delete + account/export."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import uid_from_auth, verify_bearer
from crud import upsert_subscription
from database import get_conn

router = APIRouter(prefix="/account", tags=["account"])


# ── Routes ──────────────────────────────────────────────────────


@router.get("/identity")
def account_identity(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    """Return the verified token's identity claims.

    Useful for Next.js routes that previously used Firebase Admin's
    `verifyAuthHeader` to read `uid` / `email`. The Next.js proxy just
    forwards the Authorization header to this endpoint.
    """
    return {
        "uid": auth.get("uid"),
        "email": auth.get("email"),
        "name": auth.get("name") or auth.get("firebase", {}).get("name"),
    }


class SubscriptionSyncBody(BaseModel):
    userId: str
    plan: str
    stripeStatus: str
    customerId: str | None = None
    subscriptionId: str | None = None
    periodEndMs: int | None = None
    cancelAtPeriodEnd: bool = False
    metadata: dict[str, Any] | None = None


@router.post("/subscription-sync")
def subscription_sync(
    body: SubscriptionSyncBody, auth: dict = Depends(verify_bearer)
) -> dict[str, bool]:
    """Mirror a Stripe subscription state into the SQL `subscriptions` table.

    Replaces the previous Firestore Admin write in
    `src/lib/billing/subscriptionSync.ts`. The caller must be authenticated
    and may only sync their own subscription — any attempt to write someone
    else's row is rejected.
    """
    requester = uid_from_auth(auth)
    if body.userId != requester:
        raise HTTPException(
            status_code=403,
            detail="Cannot sync subscription for another user",
        )
    with get_conn() as conn:
        upsert_subscription(
            conn,
            user_id=body.userId,
            status=body.stripeStatus,
            plan=body.plan,
            stripe_customer_id=body.customerId,
            stripe_subscription_id=body.subscriptionId,
            current_period_end=int(body.periodEndMs / 1000) if body.periodEndMs else None,
            cancel_at_period_end=body.cancelAtPeriodEnd,
            metadata=body.metadata,
        )
    return {"ok": True}


@router.get("/export")
def export_account(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    """GDPR data export. Returns a JSON document with every row this user
    owns across the SQL tables that replaced Firestore collections."""
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        rows = _fetch_user_rows(conn, uid)
    total = sum(len(v) for v in rows.values())
    return {
        "exportDate": datetime.now(timezone.utc).isoformat(),
        "userId": uid,
        "totalRecords": total,
        "data": rows,
    }


class DeleteBody(BaseModel):
    confirmDelete: str


@router.post("/delete")
def delete_account(body: DeleteBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    """GDPR account deletion. The caller must send
    `{ "confirmDelete": "DELETE_MY_ACCOUNT" }` to avoid foot-guns."""
    if body.confirmDelete != "DELETE_MY_ACCOUNT":
        raise HTTPException(
            status_code=400,
            detail="Send confirmDelete: 'DELETE_MY_ACCOUNT'",
        )
    uid = uid_from_auth(auth)
    deleted = 0
    with get_conn() as conn:
        cur = conn.cursor()
        for table, column in _USER_TABLES:
            try:
                cur.execute(f"DELETE FROM {table} WHERE {column} = ?", (uid,))
                deleted += cur.rowcount or 0
            except sqlite3.OperationalError:
                # Missing table or column — skip silently; data is best-effort.
                continue

        for sql in _EXTRA_QUERIES:
            params: tuple[Any, ...]
            if " OR " in sql:
                params = (uid, uid)
            else:
                params = (uid,)
            try:
                cur.execute(sql, params)
                deleted += cur.rowcount or 0
            except sqlite3.OperationalError:
                continue

        conn.commit()

    return {
        "success": True,
        "deletedDocuments": deleted,
        "message": (
            "Account data deleted. Sign out and contact support to remove "
            "the Firebase Auth user."
        ),
    }


# ── Helpers ─────────────────────────────────────────────────────


# Tables to walk for export/delete. Each tuple is (table, column) where
# `column` is the SQL column that holds the user id. Tables that don't have
# a single user_id column are listed below in `_EXTRA_QUERIES`.
_USER_TABLES: list[tuple[str, str]] = [
    ("reviews", "user_id"),
    ("comments", "user_id"),
    ("likes", "user_id"),
    ("content_ratings", "user_id"),
    ("user_movie_lists", "user_id"),
    ("watch_history", "user_id"),
    ("notifications", "user_id"),
    ("activity_feed", "user_id"),
    ("user_settings", "user_id"),
    ("subscriptions", "user_id"),
    ("friend_requests", "from_user_id"),
    ("friend_requests", "to_user_id"),
    ("friendships", "user_a"),
    ("friendships", "user_b"),
    ("follows", "follower_id"),
    ("follows", "following_id"),
]

# Tables whose ownership is encoded with a non-`user_id` column or that need
# bespoke SQL. We delete from these too so the user truly disappears.
_EXTRA_QUERIES: list[str] = [
    "DELETE FROM usernames WHERE uid = ?",
    "DELETE FROM profiles WHERE user_id = ?",
    "DELETE FROM watch_party_invites WHERE from_user_id = ? OR to_user_id = ?",
    "DELETE FROM party_messages WHERE sender_id = ?",
    "DELETE FROM party_participants WHERE user_id = ?",
    "DELETE FROM party_rooms WHERE host_id = ?",
    "DELETE FROM member_profiles WHERE owner_id = ?",
]


def _fetch_user_rows(conn: Any, uid: str) -> dict[str, list[dict[str, Any]]]:
    """Return a {table: [row, ...]} mapping of every row this user owns."""
    out: dict[str, list[dict[str, Any]]] = {}
    cur = conn.cursor()
    for table, column in _USER_TABLES:
        try:
            cur.execute(f"SELECT * FROM {table} WHERE {column} = ?", (uid,))
        except sqlite3.OperationalError:
            # Table doesn't have the column we expected — skip.
            continue
        cols = [d[0] for d in cur.description] if cur.description else []
        rows: list[dict[str, Any]] = []
        for row in cur.fetchall():
            rows.append({col: _serialize(val) for col, val in zip(cols, row)})
        out[table] = rows

    # Usernames (no single user_id column)
    try:
        cur.execute("SELECT * FROM usernames WHERE uid = ?", (uid,))
        cols = [d[0] for d in cur.description] if cur.description else []
        out["usernames"] = [
            {c: _serialize(v) for c, v in zip(cols, row)} for row in cur.fetchall()
        ]
    except sqlite3.OperationalError:
        out["usernames"] = []

    # Member profiles (owner_id)
    try:
        cur.execute("SELECT * FROM member_profiles WHERE owner_id = ?", (uid,))
        cols = [d[0] for d in cur.description] if cur.description else []
        out["member_profiles"] = [
            {c: _serialize(v) for c, v in zip(cols, row)} for row in cur.fetchall()
        ]
    except sqlite3.OperationalError:
        out["member_profiles"] = []

    return out


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    return val
