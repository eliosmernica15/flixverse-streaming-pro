"""Dunning email worker — handles failed payment notifications.

This worker processes Stripe invoice.payment_failed events and sends
dunning emails to users with failed payments. It implements a retry
schedule with escalating urgency.

Schedule (from Stripe's default dunning behavior):
- Attempt 1: Immediately (day 0)
- Attempt 2: Day 3
- Attempt 3: Day 5
- Attempt 4: Day 7
- Final: Day 14 (subscription canceled if unpaid)

This worker runs periodically (e.g., via cron) and checks for subscriptions
in past_due status that need dunning emails sent.
"""

from __future__ import annotations

import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import stripe
from database import db_fetchall, db_fetchone, get_conn
from crud import get_subscription

# ── Configuration ────────────────────────────────────────────────

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "billing@flixverse.com")
APP_URL = os.environ.get("APP_URL", "https://flixverse.com")

# Dunning schedule: days after payment failure to send each email
DUNNING_SCHEDULE = [
    {"day": 0, "template": "dunning_1_immediate", "subject": "Payment failed — action required"},
    {"day": 3, "template": "dunning_2_retry", "subject": "Payment still failing — 2nd attempt"},
    {"day": 5, "template": "dunning_3_retry", "subject": "Payment still failing — 3rd attempt"},
    {"day": 7, "template": "dunning_4_retry", "subject": "Payment still failing — final attempt"},
    {"day": 14, "template": "dunning_5_canceled", "subject": "Subscription canceled — payment failed"},
]

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# ── Email Templates ──────────────────────────────────────────────

EMAIL_TEMPLATES = {
    "dunning_1_immediate": """
Hi {name},

We tried to charge your payment method for your Flixverse {plan} plan, but the payment failed.

**Amount:** ${amount:.2f} {currency}
**Plan:** {plan} ({billing_period})
**Next retry:** In 3 days

Please update your payment method to avoid service interruption:
{portal_url}

If you've already updated your payment method, we'll automatically retry the charge.

Thanks,
The Flixverse Team
""",
    "dunning_2_retry": """
Hi {name},

This is our second attempt to charge your payment method for your Flixverse {plan} plan. The payment is still failing.

**Amount:** ${amount:.2f} {currency}
**Plan:** {plan} ({billing_period})
**Next retry:** In 2 days

Please update your payment method immediately to avoid service interruption:
{portal_url}

Thanks,
The Flixverse Team
""",
    "dunning_3_retry": """
Hi {name},

This is our third attempt to charge your payment method for your Flixverse {plan} plan. The payment is still failing.

**Amount:** ${amount:.2f} {currency}
**Plan:** {plan} ({billing_period})
**Next retry:** In 2 days (final attempt)

Please update your payment method immediately to avoid service interruption:
{portal_url}

Thanks,
The Flixverse Team
""",
    "dunning_4_retry": """
Hi {name},

This is our FINAL attempt to charge your payment method for your Flixverse {plan} plan. The payment is still failing.

**Amount:** ${amount:.2f} {currency}
**Plan:** {plan} ({billing_period})
**Final retry:** Today

If this payment fails, your subscription will be canceled in 7 days.

Please update your payment method immediately:
{portal_url}

Thanks,
The Flixverse Team
""",
    "dunning_5_canceled": """
Hi {name},

We've been unable to collect payment for your Flixverse {plan} plan after multiple attempts. Your subscription has been canceled.

**Plan:** {plan} ({billing_period})
**Cancellation date:** {cancellation_date}

You can resubscribe at any time:
{pricing_url}

If you believe this is an error, please contact support.

Thanks,
The Flixverse Team
""",
}


# ── Helper Functions ─────────────────────────────────────────────


def _send_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL]):
        print("Email not configured, skipping send")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
        return False


def _get_dunning_email_template(template_name: str, **kwargs) -> tuple[str, str]:
    """Generate HTML and text versions of a dunning email."""
    template = EMAIL_TEMPLATES.get(template_name, "")
    text_body = template.format(**kwargs)

    # Simple HTML version
    html_body = text_body.replace("\n", "<br>")
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Flixverse</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            {html_body}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="color: #888; font-size: 12px; text-align: center;">
                This email was sent to {kwargs.get('email', 'you')} regarding your Flixverse subscription.<br>
                © 2024 Flixverse. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    """

    return html_body, text_body


def _record_dunning_email_sent(conn: Any, user_id: str, attempt: int, email_type: str) -> None:
    """Record that a dunning email was sent."""
    import json
    from database import db_execute, now_ms

    db_execute(
        conn,
        """
        INSERT INTO dunning_emails (user_id, attempt, email_type, sent_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, attempt) DO UPDATE SET
          email_type = excluded.email_type,
          sent_at = excluded.sent_at
        """,
        (user_id, attempt, email_type, now_ms()),
    )


def _was_dunning_email_sent(conn: Any, user_id: str, attempt: int) -> bool:
    """Check if a dunning email for this attempt was already sent."""
    row = db_fetchone(
        conn,
        "SELECT 1 FROM dunning_emails WHERE user_id = ? AND attempt = ?",
        (user_id, attempt),
    )
    return row is not None


# ── Main Worker Logic ────────────────────────────────────────────

def get_subscriptions_needing_dunning() -> list[dict[str, Any]]:
    """Get all subscriptions that are past_due and need dunning emails."""
    with get_conn() as conn:
        rows = db_fetchall(
            conn,
            """
            SELECT * FROM subscriptions
            WHERE status = 'past_due'
              AND stripe_subscription_id IS NOT NULL
            """,
        )
    return [dict(row) for row in rows]


def process_dunning_for_subscription(sub: dict[str, Any]) -> dict[str, Any]:
    """Process dunning for a single subscription. Returns result summary."""
    if not STRIPE_SECRET_KEY:
        return {"error": "Stripe not configured"}

    user_id = sub["user_id"]
    stripe_sub_id = sub["stripe_subscription_id"]
    stripe_customer_id = sub["stripe_customer_id"]

    try:
        # Get subscription from Stripe to check latest invoice status
        stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)

        # Get the latest invoice
        invoices = stripe.Invoice.list(
            subscription=stripe_sub_id,
            limit=1,
        )

        if not invoices.data:
            return {"status": "no_invoice", "user_id": user_id}

        latest_invoice = invoices.data[0]

        # Check if invoice is paid or void
        if latest_invoice.status in ("paid", "void"):
            return {"status": "already_resolved", "user_id": user_id}

        # Get the payment failure date
        # For past_due subscriptions, the invoice.due_date or created date
        failure_date = datetime.fromtimestamp(latest_invoice.created, tz=timezone.utc)
        days_since_failure = (datetime.now(timezone.utc) - failure_date).days

        # Determine which dunning email to send
        email_to_send = None
        for i, schedule in enumerate(DUNNING_SCHEDULE):
            if days_since_failure >= schedule["day"]:
                email_to_send = (i, schedule)
            else:
                break

        if email_to_send is None:
            return {"status": "too_early", "user_id": user_id, "days_since_failure": days_since_failure}

        attempt_index, schedule = email_to_send

        with get_conn() as conn:
            # Check if this attempt was already sent
            if _was_dunning_email_sent(conn, user_id, attempt_index):
                return {"status": "already_sent", "user_id": user_id, "attempt": attempt_index}

            # Get user email from Stripe customer
            customer = stripe.Customer.retrieve(stripe_customer_id)
            user_email = customer.email

            if not user_email:
                return {"status": "no_email", "user_id": user_id}

            # Get plan info
            plan = sub.get("plan", "standard")
            billing_period = "monthly"
            if stripe_sub.items.data:
                price = stripe.Price.retrieve(stripe_sub.items.data[0].price.id)
                if price.recurring and price.recurring.interval == "year":
                    billing_period = "yearly"

            # Calculate amount
            amount = latest_invoice.amount_due / 100
            currency = latest_invoice.currency.upper()

            # Generate portal URL
            portal_url = f"{APP_URL}/profile?tab=billing"
            pricing_url = f"{APP_URL}/plans"

            # Format cancellation date for final email
            cancellation_date = (failure_date + timedelta(days=14)).strftime("%B %d, %Y")

            # Prepare template variables
            template_vars = {
                "name": customer.name or "there",
                "email": user_email,
                "plan": plan.capitalize(),
                "billing_period": billing_period,
                "amount": amount,
                "currency": currency,
                "portal_url": portal_url,
                "pricing_url": pricing_url,
                "cancellation_date": cancellation_date,
            }

            # Send email
            html_body, text_body = _get_dunning_email_template(schedule["template"], **template_vars)
            sent = _send_email(user_email, schedule["subject"], html_body, text_body)

            if sent:
                _record_dunning_email_sent(conn, user_id, attempt_index, schedule["template"])
                return {
                    "status": "sent",
                    "user_id": user_id,
                    "attempt": attempt_index,
                    "template": schedule["template"],
                    "days_since_failure": days_since_failure,
                }
            else:
                return {"status": "send_failed", "user_id": user_id, "attempt": attempt_index}

    except stripe.StripeError as e:
        return {"status": "stripe_error", "user_id": user_id, "error": str(e)}
    except Exception as e:
        return {"status": "error", "user_id": user_id, "error": str(e)}


def run_dunning_worker() -> dict[str, Any]:
    """Main entry point for the dunning worker. Run periodically via cron."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting dunning worker...")

    if not STRIPE_SECRET_KEY:
        return {"error": "STRIPE_SECRET_KEY not configured"}

    subscriptions = get_subscriptions_needing_dunning()
    print(f"Found {len(subscriptions)} subscriptions in past_due status")

    results = []
    for sub in subscriptions:
        result = process_dunning_for_subscription(sub)
        results.append(result)
        print(f"  User {sub['user_id']}: {result.get('status', 'unknown')}")

    sent_count = sum(1 for r in results if r.get("status") == "sent")
    print(f"Dunning worker completed. Sent {sent_count} emails.")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "processed": len(subscriptions),
        "emails_sent": sent_count,
        "results": results,
    }


if __name__ == "__main__":
    import json
    result = run_dunning_worker()
    print(json.dumps(result, indent=2))