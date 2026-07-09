import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

    return NextResponse.json({
      planId: session.metadata?.planId || "standard",
      userId: session.metadata?.userId,
      customerId: session.customer,
      subscriptionId: session.subscription,
      status: "trialing",
    });
  } catch (err) {
    console.error("Session verify error:", err);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }
}
