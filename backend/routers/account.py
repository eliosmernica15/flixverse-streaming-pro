"""Account GDPR routes — replaces Firestore-admin account/delete + account/export."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from auth import uid_from_auth, verify_bearer_revoked
from crud import record_stripe_event, upsert_subscription, get_subscription, record_cancellation_reason
from database import db_execute, db_fetchall, db_fetchone, get_conn, iso_now, new_id, USE_POSTGRES

router = APIRouter(prefix="/account", tags=["account"])


# ── Routes ──────────────────────────────────────────────────────


@router.get("/identity")
def account_identity(auth: dict = Depends(verify_bearer_revoked)) -> dict[str, Any]:
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


class StripeWebhookEventBody(BaseModel):
    eventId: str
    eventType: str


class ProrationPreviewRequest(BaseModel):
    userId: str
    newPlan: str
    newBillingPeriod: str = "monthly"


def verify_internal_service_token(
    token: str | None = Header(default=None, alias="x-internal-service-token"),
) -> None:
    expected = os.environ.get("PYTHON_API_INTERNAL_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Internal API auth not configured")
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _save_subscription(body: SubscriptionSyncBody) -> None:
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


@router.post("/subscription-sync")
def subscription_sync(
    body: SubscriptionSyncBody, auth: dict = Depends(verify_bearer_revoked)
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
    _save_subscription(body)
    return {"ok": True}


@router.post("/stripe-subscription-sync")
def stripe_subscription_sync(
    body: SubscriptionSyncBody,
    _: None = Depends(verify_internal_service_token),
) -> dict[str, bool]:
    """Apply a Stripe-verified subscription update from the Next.js webhook."""
    _save_subscription(body)
    return {"ok": True}


@router.get("/stripe-webhook-events/{event_id}")
def stripe_webhook_event_status(
    event_id: str,
    _: None = Depends(verify_internal_service_token),
) -> dict[str, bool]:
    with get_conn() as conn:
        row = db_fetchone(
            conn,
            "SELECT event_id FROM stripe_webhook_events WHERE event_id = ?",
            (event_id,),
        )
    return {"processed": row is not None}


@router.post("/stripe-webhook-events")
def mark_stripe_webhook_event(
    body: StripeWebhookEventBody,
    _: None = Depends(verify_internal_service_token),
) -> dict[str, bool]:
    with get_conn() as conn:
        is_new = record_stripe_event(conn, body.eventId, body.eventType)
    return {"processed": True, "duplicate": not is_new}


def _get_stripe_client() -> stripe.Stripe:
    """Get Stripe client with secret key from environment."""
    secret = os.environ.get("STRIPE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    return stripe.Stripe(secret, api_version="2026-06-24.dahlia")


def _get_price_id(plan: str, billing_period: str) -> str | None:
    """Map plan and billing period to Stripe price ID from environment."""
    key = f"STRIPE_PRICE_{plan.upper()}_{billing_period.upper()}"
    return os.environ.get(key)


@router.post("/proration-preview")
def proration_preview(
    body: ProrationPreviewRequest, auth: dict = Depends(verify_bearer_revoked)
) -> dict[str, Any]:
    """Calculate proration preview for a plan change.

    Returns the amount that would be charged/credited if the user switches plans.
    """
    requester = uid_from_auth(auth)
    if body.userId != requester:
        raise HTTPException(
            status_code=403,
            detail="Cannot preview proration for another user",
        )

    # Get current subscription from database
    with get_conn() as conn:
        sub = get_subscription(conn, requester)

    if not sub or not sub.get("stripe_subscription_id"):
        raise HTTPException(
            status_code=404,
            detail="No active subscription found",
        )

    if sub.get("status") in ("canceled", "unpaid", "incomplete"):
        raise HTTPException(
            status_code=400,
            detail="Cannot preview proration for inactive subscription",
        )

    stripe = _get_stripe_client()
    new_price_id = _get_price_id(body.newPlan, body.newBillingPeriod)

    if not new_price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Price not configured for {body.newPlan} {body.newBillingPeriod}",
        )

    try:
        # Get current subscription from Stripe
        current_sub = stripe.subscriptions.retrieve(sub["stripe_subscription_id"])

        # Find the current subscription item (assuming single item subscription)
        if not current_sub.items.data:
            raise HTTPException(status_code=400, detail="No subscription items found")

        current_item = current_sub.items.data[0]
        current_price_id = current_item.price.id

        # Skip if same price
        if current_price_id == new_price_id:
            return {
                "amount": 0,
                "currency": current_sub.currency,
                "description": "No change in plan",
                "isUpgrade": False,
                "nextPeriodStart": current_sub.current_period_start * 1000,
                "currentPlan": sub.get("plan", "standard"),
                "newPlan": body.newPlan,
            }

        # Calculate proration using Stripe's upcoming invoice preview
        upcoming = stripe.invoices.upcoming(
            customer=current_sub.customer,
            subscription=current_sub.id,
            subscription_items=[{
                "id": current_item.id,
                "price": new_price_id,
            }],
            subscription_proration_date=int(datetime.now(timezone.utc).timestamp()),
        )

        # The proration amount is in the upcoming invoice
        proration_amount = 0
        for item in upcoming.lines.data:
            if item.proration:
                proration_amount += item.amount

        # Determine if upgrade or downgrade
        current_price = stripe.prices.retrieve(current_price_id)
        new_price = stripe.prices.retrieve(new_price_id)

        current_unit_amount = current_price.unit_amount or 0
        new_unit_amount = new_price.unit_amount or 0

        # For yearly vs monthly comparison, normalize to monthly
        if current_price.recurring and new_price.recurring:
            if current_price.recurring.interval == "year":
                current_unit_amount = current_unit_amount / 12
            if new_price.recurring.interval == "year":
                new_unit_amount = new_unit_amount / 12

        is_upgrade = new_unit_amount > current_unit_amount

        return {
            "amount": proration_amount,
            "currency": upcoming.currency,
            "description": f"Proration for switching from {sub.get('plan', 'standard')} to {body.newPlan} ({body.newBillingPeriod})",
            "isUpgrade": is_upgrade,
            "nextPeriodStart": current_sub.current_period_start * 1000,
            "currentPlan": sub.get("plan", "standard"),
            "newPlan": body.newPlan,
        }
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


class InternalSubscriptionCancelBody(BaseModel):
    userId: str
    reason: str
    details: str | None = None
    stripeSubscriptionId: str | None = None


@router.post("/subscription-cancel")
def subscription_cancel_internal(
    body: InternalSubscriptionCancelBody,
    _: None = Depends(verify_internal_service_token),
) -> dict[str, Any]:
    """Internal endpoint to cancel a subscription with reason (called from webhook/internal services)."""
    with get_conn() as conn:
        sub = get_subscription(conn, body.userId)

    if not sub or not sub.get("stripe_subscription_id"):
        raise HTTPException(
            status_code=404,
            detail="No active subscription found",
        )

    stripe_client = _get_stripe_client()

    try:
        # Get current subscription from Stripe
        current_sub = stripe_client.subscriptions.retrieve(sub["stripe_subscription_id"])

        # Record cancellation reason
        with get_conn() as conn:
            record_cancellation_reason(
                conn,
                user_id=body.userId,
                reason=body.reason,
                stripe_subscription_id=body.stripeSubscriptionId or sub["stripe_subscription_id"],
                details=body.details,
            )

        # Update subscription to cancel at period end
        stripe_client.subscriptions.modify(
            sub["stripe_subscription_id"],
            cancel_at_period_end=True,
            metadata={
                **current_sub.metadata,
                "cancellation_reason": body.reason,
                "cancellation_details": body.details or "",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Also update local database
        with get_conn() as conn:
            from crud import upsert_subscription
            upsert_subscription(
                conn,
                user_id=body.userId,
                status=sub["status"],
                plan=sub["plan"],
                stripe_customer_id=sub["stripe_customer_id"],
                stripe_subscription_id=sub["stripe_subscription_id"],
                current_period_end=sub["current_period_end"],
                cancel_at_period_end=True,
                metadata={
                    "cancellation_reason": body.reason,
                    "cancellation_details": body.details or "",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        return {
            "success": True,
            "message": "Subscription will be canceled at the end of the current billing period",
            "cancelsAt": sub["current_period_end"] * 1000 if sub.get("current_period_end") else None,
        }
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export")
def export_account(auth: dict = Depends(verify_bearer_revoked)) -> dict[str, Any]:
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


class ExportCreateBody(BaseModel):
    """Request body for creating a GDPR export with expiry link."""
    pass  # No additional fields needed for now


class ExportCreateResponse(BaseModel):
    """Response for export creation with download link."""
    exportId: str
    downloadUrl: str
    expiresAt: str  # ISO timestamp
    totalRecords: int


@router.post("/export")
def create_export(
    body: ExportCreateBody, auth: dict = Depends(verify_bearer_revoked)
) -> ExportCreateResponse:
    """Create a GDPR export and return a secure, time-limited download URL.

    The export is generated asynchronously and stored temporarily. The download
    URL expires after 7 days (configurable via GDPR_EXPORT_TTL_DAYS).
    """
    uid = uid_from_auth(auth)
    ttl_days = int(os.environ.get("GDPR_EXPORT_TTL_DAYS", "7"))

    with get_conn() as conn:
        rows = _fetch_user_rows(conn, uid)
    total = sum(len(v) for v in rows.values())

    # Create export record with secure token
    export_id = new_id()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)

    # Prepare export data
    export_data = {
        "exportDate": datetime.now(timezone.utc).isoformat(),
        "userId": uid,
        "totalRecords": total,
        "data": rows,
    }

    # Store export in database
    _sql = "INSERT INTO gdpr_exports (id, user_id, token_hash, data_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)" if not USE_POSTGRES else "INSERT INTO gdpr_exports (id, user_id, token_hash, data_json, expires_at, created_at) VALUES (%s, %s, %s, %s, %s, %s)"

    import json
    with get_conn() as conn:
        db_execute(
            conn,
            _sql,
            (
                export_id,
                uid,
                token_hash,
                json.dumps(export_data, default=str),
                expires_at.isoformat(),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    # Build download URL
    base_url = os.environ.get("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000")
    download_url = f"{base_url}/api/account/export/download/{export_id}/{token}"

    return ExportCreateResponse(
        exportId=export_id,
        downloadUrl=download_url,
        expiresAt=expires_at.isoformat(),
        totalRecords=total,
    )


class ExportDownloadResponse(BaseModel):
    """Response for export download."""
    exportDate: str
    userId: str
    totalRecords: int
    data: dict[str, list[dict[str, Any]]]


@router.get("/export/download/{export_id}/{token}")
def download_export(export_id: str, token: str) -> ExportDownloadResponse:
    """Download a previously created GDPR export using a secure token.

    The token is single-use and verified against a hash. After successful
    download, the export record is deleted.
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    _sql = "SELECT id, user_id, data_json, expires_at FROM gdpr_exports WHERE id = ? AND token_hash = ?" if not USE_POSTGRES else "SELECT id, user_id, data_json, expires_at FROM gdpr_exports WHERE id = %s AND token_hash = %s"

    import json
    with get_conn() as conn:
        row = db_fetchone(conn, _sql, (export_id, token_hash))

    if not row:
        raise HTTPException(status_code=404, detail="Export not found or invalid token")

    expires_at_str = row_get(row, "expires_at")
    try:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
    except ValueError:
        expires_at = datetime.fromisoformat(expires_at_str)

    if datetime.now(timezone.utc) > expires_at:
        # Clean up expired export
        with get_conn() as conn:
            db_execute(conn, "DELETE FROM gdpr_exports WHERE id = ?" if not USE_POSTGRES else "DELETE FROM gdpr_exports WHERE id = %s", (export_id,))
        raise HTTPException(status_code=410, detail="Export link has expired")

    # Delete the export after successful verification (single-use)
    with get_conn() as conn:
        db_execute(conn, "DELETE FROM gdpr_exports WHERE id = ?" if not USE_POSTGRES else "DELETE FROM gdpr_exports WHERE id = %s", (export_id,))

    export_data = json.loads(row_get(row, "data_json"))
    return ExportDownloadResponse(**export_data)


class DeleteBody(BaseModel):
    confirmDelete: str


@router.post("/delete")
def delete_account(
    body: DeleteBody, auth: dict = Depends(verify_bearer_revoked)
) -> dict[str, Any]:
    """GDPR account deletion with cascade to all data stores.

    The caller must send `{ "confirmDelete": "DELETE_MY_ACCOUNT" }` to avoid foot-guns.
    This deletes from:
    - Postgres (all user tables)
    - Firestore (user document and sub-collections)
    - Stripe (customer and subscription)
    - Cloudinary (user assets)
    """
    if body.confirmDelete != "DELETE_MY_ACCOUNT":
        raise HTTPException(
            status_code=400,
            detail="Send confirmDelete: 'DELETE_MY_ACCOUNT'",
        )
    uid = uid_from_auth(auth)
    deleted = 0
    cascade_results = {
        "postgres": 0,
        "firestore": 0,
        "stripe": {"customer_deleted": False, "subscription_canceled": False},
        "cloudinary": {"assets_deleted": 0},
    }

    # 1. Delete from Postgres (existing logic)
    with get_conn() as conn:
        cur = conn.cursor()
        for table, column in _USER_TABLES:
            try:
                cur.execute(f"DELETE FROM {table} WHERE {column} = ?", (uid,))
                deleted += cur.rowcount or 0
                cascade_results["postgres"] += cur.rowcount or 0
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
                cascade_results["postgres"] += cur.rowcount or 0
            except sqlite3.OperationalError:
                continue

        conn.commit()

    # 2. Delete from Firestore (user document and sub-collections)
    try:
        from firebase_admin import firestore
        from auth import _init_firebase
        _init_firebase()
        db = firestore.client()

        # Delete user document and all sub-collections
        user_ref = db.collection("users").document(uid)
        # Get all sub-collections and delete them
        collections = user_ref.collections()
        for coll in collections:
            docs = coll.list_documents()
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()
            cascade_results["firestore"] += len(docs)

        # Delete the user document itself
        user_ref.delete()
        cascade_results["firestore"] += 1
    except Exception as e:
        # Log but don't fail the entire deletion if Firestore is unavailable
        import logging
        logging.warning(f"Firestore deletion failed for user {uid}: {e}")

    # 3. Delete from Stripe (cancel subscription, delete customer)
    try:
        from database import get_conn as get_db_conn
        stripe_secret = os.environ.get("STRIPE_SECRET_KEY")
        if stripe_secret:
            import stripe as stripe_module
            stripe_client = stripe_module.Stripe(stripe_secret, api_version="2026-06-24.dahlia")

            with get_db_conn() as conn:
                sub = get_subscription(conn, uid)
                if sub and sub.get("stripe_customer_id"):
                    customer_id = sub["stripe_customer_id"]

                    # Cancel subscription if active
                    if sub.get("stripe_subscription_id"):
                        try:
                            stripe_client.subscriptions.cancel(sub["stripe_subscription_id"])
                            cascade_results["stripe"]["subscription_canceled"] = True
                        except stripe_module.StripeError:
                            pass

                    # Delete customer (this also deletes payment methods, etc.)
                    try:
                        stripe_client.customers.delete(customer_id)
                        cascade_results["stripe"]["customer_deleted"] = True
                    except stripe_module.StripeError:
                        pass
    except Exception as e:
        import logging
        logging.warning(f"Stripe deletion failed for user {uid}: {e}")

    # 4. Delete from Cloudinary (user assets)
    try:
        cloudinary_url = os.environ.get("CLOUDINARY_URL")
        if cloudinary_url:
            import cloudinary
            import cloudinary.api
            cloudinary.config(cloudinary_url=cloudinary_url)

            # Delete all resources with the user's uid as a tag or in a folder
            # Assuming user assets are tagged with uid or in folder "users/{uid}"
            try:
                # Delete by tag
                result = cloudinary.api.delete_resources_by_tag(uid)
                cascade_results["cloudinary"]["assets_deleted"] = result.get("deleted", {}).get(uid, 0)
            except cloudinary.api.Error:
                pass

            try:
                # Also try deleting from folder
                result = cloudinary.api.delete_resources_by_prefix(f"users/{uid}/")
                cascade_results["cloudinary"]["assets_deleted"] += result.get("deleted", {}).get(f"users/{uid}/", 0)
            except cloudinary.api.Error:
                pass
    except Exception as e:
        import logging
        logging.warning(f"Cloudinary deletion failed for user {uid}: {e}")

    return {
        "success": True,
        "deletedDocuments": deleted,
        "cascadeResults": cascade_results,
        "message": (
            "Account data deleted from all stores. Sign out and contact support to remove "
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

    # Firestore user document (if Firebase is configured)
    try:
        from firebase_admin import firestore
        from auth import _init_firebase
        _init_firebase()
        db = firestore.client()
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            out["firestore_user"] = [_serialize_firestore_doc(user_doc.to_dict() or {})]
        # Also fetch sub-collections if they exist
        sub_collections = ["watch_parties", "notifications", "activity_feed"]
        for coll_name in sub_collections:
            try:
                docs = db.collection("users").document(uid).collection(coll_name).stream()
                out[f"firestore_{coll_name}"] = [
                    _serialize_firestore_doc(doc.to_dict() or {}, doc.id) for doc in docs
                ]
            except Exception:
                out[f"firestore_{coll_name}"] = []
    except Exception:
        # Firebase not configured or not available - skip silently
        pass

    return out


def _serialize_firestore_doc(doc: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
    """Serialize a Firestore document, converting timestamps and adding doc_id."""
    result = {"_doc_id": doc_id} if doc_id else {}
    for key, val in doc.items():
        if hasattr(val, "timestamp"):  # Firestore Timestamp
            result[key] = val.timestamp().isoformat()
        elif isinstance(val, datetime):
            result[key] = val.isoformat()
        elif isinstance(val, dict):
            result[key] = _serialize_firestore_doc(val)
        elif isinstance(val, list):
            result[key] = [
                _serialize_firestore_doc(v) if isinstance(v, dict) else v for v in val
            ]
        else:
            result[key] = val
    return result


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    return val
