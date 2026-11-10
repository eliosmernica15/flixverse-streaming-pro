"""Subscription routes — replaces Firestore /subscriptions.

Stripe is still the source of truth for billing; this just mirrors a
read-only view of the active subscription for the client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import stripe
from auth import uid_from_auth, verify_bearer_revoked
from crud import get_subscription, record_cancellation_reason, get_cancellation_reasons
from database import db_fetchone, get_conn

router = APIRouter(prefix="/subscription", tags=["subscription"])


# ── Pydantic Models ──────────────────────────────────────────────


class ProrationPreviewRequest(BaseModel):
    newPlan: str
    newBillingPeriod: str = "monthly"


class CancelSubscriptionRequest(BaseModel):
    reason: str
    details: str | None = None


# ── Helpers ──────────────────────────────────────────────────────


def _get_stripe_client() -> stripe.Stripe:
    """Get Stripe client with secret key from environment."""
    import os
    secret = os.environ.get("STRIPE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    return stripe.Stripe(secret, api_version="2026-06-24.dahlia")


def _get_price_id(plan: str, billing_period: str) -> str | None:
    """Map plan and billing period to Stripe price ID from environment."""
    import os
    key = f"STRIPE_PRICE_{plan.upper()}_{billing_period.upper()}"
    return os.environ.get(key)


# ── Routes ───────────────────────────────────────────────────────


@router.get("")
def fetch(auth: dict = Depends(verify_bearer_revoked)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        sub = get_subscription(conn, uid)
    return {"subscription": sub}


@router.post("/proration-preview")
def proration_preview(
    body: ProrationPreviewRequest, auth: dict = Depends(verify_bearer_revoked)
) -> dict[str, Any]:
    """Calculate proration preview for a plan change.

    Returns the amount that would be charged/credited if the user switches plans.
    """
    uid = uid_from_auth(auth)

    with get_conn() as conn:
        sub = get_subscription(conn, uid)

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

    stripe_client = _get_stripe_client()
    new_price_id = _get_price_id(body.newPlan, body.newBillingPeriod)

    if not new_price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Price not configured for {body.newPlan} {body.newBillingPeriod}",
        )

    try:
        # Get current subscription from Stripe
        current_sub = stripe_client.subscriptions.retrieve(sub["stripe_subscription_id"])

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
        upcoming = stripe_client.invoices.upcoming(
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
        current_price = stripe_client.prices.retrieve(current_price_id)
        new_price = stripe_client.prices.retrieve(new_price_id)

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


@router.post("/cancel")
def cancel_subscription(
    body: CancelSubscriptionRequest, auth: dict = Depends(verify_bearer_revoked)
) -> dict[str, Any]:
    """Record cancellation reason and initiate cancellation at period end."""
    import os
    from datetime import datetime, timezone
    uid = uid_from_auth(auth)

    with get_conn() as conn:
        sub = get_subscription(conn, uid)

    if not sub or not sub.get("stripe_subscription_id"):
        raise HTTPException(
            status_code=404,
            detail="No active subscription found",
        )

    if sub.get("status") in ("canceled", "unpaid", "incomplete"):
        raise HTTPException(
            status_code=400,
            detail="Subscription already canceled or inactive",
        )

    stripe_client = _get_stripe_client()

    try:
        # Get current subscription from Stripe
        current_sub = stripe_client.subscriptions.retrieve(sub["stripe_subscription_id"])

        # Record cancellation reason
        with get_conn() as conn:
            record_cancellation_reason(
                conn,
                user_id=uid,
                reason=body.reason,
                stripe_subscription_id=sub["stripe_subscription_id"],
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
                user_id=uid,
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


@router.get("/cancellation-reasons")
def fetch_cancellation_reasons(auth: dict = Depends(verify_bearer_revoked)) -> dict[str, Any]:
    """Get all cancellation reasons for the current user."""
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        reasons = get_cancellation_reasons(conn, uid)
    return {"cancellationReasons": reasons}