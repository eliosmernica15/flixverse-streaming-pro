import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { syncSubscriptionToFirestore, type BillingPlan } from "@/lib/billing/subscriptionSync";

export const runtime = "nodejs";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

/** Verify a completed Stripe Checkout session and return plan details. */
export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Session not complete" }, { status: 400 });
    }

    const planId = (session.metadata?.planId as BillingPlan) || "standard";
    const userId = session.metadata?.userId;
    let status = "trialing";
    let periodEndMs: number | undefined;

    if (session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      status = sub.status;
      const end = (sub as unknown as { current_period_end?: number }).current_period_end;
      if (end) periodEndMs = end * 1000;

      if (userId) {
        await syncSubscriptionToFirestore({
          userId,
          plan: planId,
          stripeStatus: sub.status,
          customerId: String(session.customer),
          subscriptionId: sub.id,
          periodEndMs: periodEndMs ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      }
    }

    return NextResponse.json({
      planId,
      userId,
      customerId: session.customer,
      subscriptionId: session.subscription,
      status,
      currentPeriodEnd: periodEndMs,
    });
  } catch (err) {
    console.error("Session verify error:", err);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }
}
