import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  syncSubscriptionToFirestore,
  cancelSubscriptionInFirestore,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
  type BillingPlan,
} from "@/lib/billing/subscriptionSync";
import {
  getSubscriptionPeriodEndMs,
  getInvoiceSubscriptionId,
} from "@/lib/billing/stripeDahlia";

export const runtime = "nodejs";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

function getPeriodEndMs(sub: Stripe.Subscription): number {
  // dahlia: current_period_end lives on subscription items (see stripeDahlia.ts)
  return getSubscriptionPeriodEndMs(sub) ?? Date.now() + 30 * 24 * 60 * 60 * 1000;
}

function getPlanFromMetadata(metadata: Stripe.Metadata | null | undefined): BillingPlan {
  const plan = metadata?.planId;
  return plan === "premium" ? "premium" : "standard";
}

async function handleSubscription(
  sub: Stripe.Subscription,
  fallbackPlan?: BillingPlan,
  requestOrigin?: string
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
  }, requestOrigin);
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

  const requestOrigin = request.nextUrl.origin;
  try {
    if (await isWebhookEventProcessed(event.id, requestOrigin)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

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
          }, requestOrigin);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscription(sub, undefined, requestOrigin);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await cancelSubscriptionInFirestore(
            userId,
            String(sub.customer),
            sub.id,
            requestOrigin
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getInvoiceSubscriptionId(invoice);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(sub, undefined, requestOrigin);
        }
        break;
      }

      case "invoice.paid": {
        // Payment recovered - update subscription status
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getInvoiceSubscriptionId(invoice);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(sub, undefined, requestOrigin);
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Notify user that trial is ending soon
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          // Could trigger a notification here
          console.log(`Trial ending soon for user ${userId}, subscription ${sub.id}`);
        }
        break;
      }

      default:
        break;
    }

    await markWebhookEventProcessed(event.id, event.type, requestOrigin);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Configuration health check — no secrets exposed. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}