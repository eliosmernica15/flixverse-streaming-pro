import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  syncSubscriptionToFirestore,
  cancelSubscriptionInFirestore,
  markWebhookEventProcessed,
  type BillingPlan,
} from "@/lib/billing/subscriptionSync";

export const runtime = "nodejs";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

function getPeriodEndMs(sub: Stripe.Subscription): number {
  const end = (sub as unknown as { current_period_end?: number }).current_period_end;
  return end ? end * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;
}

function getPlanFromMetadata(metadata: Stripe.Metadata | null | undefined): BillingPlan {
  const plan = metadata?.planId;
  return plan === "premium" ? "premium" : "standard";
}

async function handleSubscription(
  sub: Stripe.Subscription,
  fallbackPlan?: BillingPlan
) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const plan = fallbackPlan ?? getPlanFromMetadata(sub.metadata);
  await syncSubscriptionToFirestore({
    userId,
    plan,
    stripeStatus: sub.status,
    customerId: String(sub.customer),
    subscriptionId: sub.id,
    periodEndMs: getPeriodEndMs(sub),
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const isNew = await markWebhookEventProcessed(event.id);
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = getPlanFromMetadata(session.metadata);
        if (userId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscriptionToFirestore({
            userId,
            plan: planId,
            stripeStatus: sub.status,
            customerId: String(session.customer),
            subscriptionId: sub.id,
            periodEndMs: getPeriodEndMs(sub),
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await cancelSubscriptionInFirestore(
            userId,
            String(sub.customer),
            sub.id
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as { subscription?: string | null }).subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(sub);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
