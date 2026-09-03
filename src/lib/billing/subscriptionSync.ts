/**
 * Subscription sync — mirrors Stripe subscription state into the
 * Python `subscriptions` table via `/account/subscription-sync`.
 *
 * This replaces the previous Firestore Admin write that was a hard
 * dependency for the post-Firestore migration.
 */

export type BillingPlan = "standard" | "premium";
export type BillingStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete";

export interface SubscriptionRecord {
  plan: BillingPlan | "free";
  status: BillingStatus | "none";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
  updatedAt: number;
}

function mapStripeStatus(status: string): SubscriptionRecord["status"] {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled") return "canceled";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete";
  return "none";
}

function isPaidStatus(status: SubscriptionRecord["status"]): boolean {
  return status === "active" || status === "trialing";
}

const API_TIMEOUT_MS = 6000;

async function postSubscriptionSync(body: Record<string, unknown>): Promise<boolean> {
  const base =
    typeof window === "undefined"
      ? process.env.PYTHON_API_URL || "http://127.0.0.1:8000"
      : process.env.NEXT_PUBLIC_VERCEL === "1" || process.env.NODE_ENV === "production"
        ? "/api/flixverse"
        : "http://127.0.0.1:8000";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const res = await fetch(`${base}/account/subscription-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    console.warn("[subscriptionSync] Python sync failed:", err);
    return false;
  }
}

/** Write subscription state from Stripe webhooks (proxied through Python). */
export async function syncSubscriptionToFirestore(input: {
  userId: string;
  plan: BillingPlan;
  stripeStatus: string;
  customerId: string;
  subscriptionId: string;
  periodEndMs: number;
}): Promise<boolean> {
  const status = mapStripeStatus(input.stripeStatus);
  const plan = isPaidStatus(status) ? input.plan : "free";

  return postSubscriptionSync({
    userId: input.userId,
    plan,
    stripeStatus: status,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    periodEndMs: input.periodEndMs,
  });
}

/** Mark subscription canceled (subscription deleted). */
export async function cancelSubscriptionInFirestore(
  userId: string,
  customerId?: string,
  subscriptionId?: string
): Promise<boolean> {
  return postSubscriptionSync({
    userId,
    plan: "free",
    stripeStatus: "canceled",
    customerId,
    subscriptionId,
  });
}

/**
 * Idempotency for Stripe webhooks — kept as a no-op now that
 * idempotency lives in the Python `stripe_webhook_events` table. Returning
 * `true` preserves the existing call-site contract (webhook treated as
 * processed) so legacy callers don't break.
 */
export async function markWebhookEventProcessed(_eventId: string): Promise<boolean> {
  return true;
}
