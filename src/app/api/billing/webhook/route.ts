import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { doc, setDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

async function syncSubscriptionToFirestore(
  userId: string,
  plan: "standard" | "premium",
  status: string,
  customerId: string,
  subscriptionId: string,
  periodEnd: number
) {
  const db = getDb();
  await setDoc(
    doc(db, "subscriptions", userId),
    {
      plan,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: periodEnd,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId as "standard" | "premium" | undefined;
      if (userId && planId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const periodEnd =
          (sub as unknown as { current_period_end?: number }).current_period_end ??
          Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        await syncSubscriptionToFirestore(
          userId,
          planId,
          sub.status,
          session.customer as string,
          sub.id,
          periodEnd * 1000
        );
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const planId = (sub.metadata?.planId as "standard" | "premium") || "standard";
      if (userId) {
        const periodEnd =
          (sub as unknown as { current_period_end?: number }).current_period_end ??
          Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        await syncSubscriptionToFirestore(
          userId,
          planId,
          sub.status,
          sub.customer as string,
          sub.id,
          periodEnd * 1000
        );
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
