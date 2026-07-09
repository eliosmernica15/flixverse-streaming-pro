import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

const PRICE_MAP: Record<string, string | undefined> = {
  standard_monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY,
  standard_yearly: process.env.STRIPE_PRICE_STANDARD_YEARLY,
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
};

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY and price IDs to .env" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { planId, billingPeriod, userId, email } = body as {
    planId: "standard" | "premium";
    billingPeriod: "monthly" | "yearly";
    userId: string;
    email: string;
  };

  if (!userId || !email || !planId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const priceKey = `${planId}_${billingPeriod}` as keyof typeof PRICE_MAP;
  const priceId = PRICE_MAP[priceKey];
  if (!priceId) {
    return NextResponse.json({ error: `Price not configured for ${priceKey}` }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, planId },
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId, planId },
      },
      success_url: `${origin}/plans?success=1`,
      cancel_url: `${origin}/plans?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
