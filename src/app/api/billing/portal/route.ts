import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { customerId } = await request.json();
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
