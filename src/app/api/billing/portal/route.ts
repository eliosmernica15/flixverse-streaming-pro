import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { callPythonJson } from "@/app/api/_lib/pythonOrigin";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

export const runtime = "nodejs";

interface SubscriptionResponse {
  subscription: {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    status: string | null;
  } | null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await callPythonJson<SubscriptionResponse>(request, "/subscription");
  if (sub.error || !sub.data?.subscription) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: sub.status === 200 ? 404 : sub.status === 401 ? 401 : 502 }
    );
  }

  const customerId = sub.data.subscription.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile?tab=billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
