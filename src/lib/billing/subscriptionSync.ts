import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

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

/** Write subscription state from Stripe webhooks (Admin SDK). */
export async function syncSubscriptionToFirestore(input: {
  userId: string;
  plan: BillingPlan;
  stripeStatus: string;
  customerId: string;
  subscriptionId: string;
  periodEndMs: number;
}): Promise<boolean> {
  const db = getAdminDb();
  if (!db) {
    console.warn("Firebase Admin not configured — skipping subscription sync");
    return false;
  }

  const status = mapStripeStatus(input.stripeStatus);
  const plan = isPaidStatus(status) ? input.plan : "free";

  await db
    .collection("subscriptions")
    .doc(input.userId)
    .set(
      {
        plan,
        status,
        stripeCustomerId: input.customerId,
        stripeSubscriptionId: input.subscriptionId,
        currentPeriodEnd: input.periodEndMs,
        updatedAt: Date.now(),
        syncedBy: "stripe-webhook",
      },
      { merge: true }
    );

  return true;
}

/** Mark subscription canceled (subscription deleted). */
export async function cancelSubscriptionInFirestore(
  userId: string,
  customerId?: string,
  subscriptionId?: string
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;

  await db.collection("subscriptions").doc(userId).set(
    {
      plan: "free",
      status: "canceled",
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      updatedAt: Date.now(),
      syncedBy: "stripe-webhook",
    },
    { merge: true }
  );

  return true;
}

/** Idempotency — skip duplicate Stripe events. */
export async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return true;

  const ref = db.collection("stripe_webhook_events").doc(eventId);
  const snap = await ref.get();
  if (snap.exists) return false;

  await ref.set({
    processedAt: FieldValue.serverTimestamp(),
  });

  return true;
}
