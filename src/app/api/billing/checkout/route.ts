import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { callPythonJson } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { z } from "zod";

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

export const runtime = "nodejs";

interface IdentityResponse {
  uid: string;
  email: string | null;
  name: string | null;
}

const checkoutSchema = z.object({
  planId: z.enum(["standard", "premium"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
});

export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "billing-checkout", 10, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY and price IDs to .env" },
      { status: 503 }
    );
  }

  const ident = await callPythonJson<IdentityResponse>(request, "/account/identity");
  if (ident.error || !ident.data?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { uid, email } = ident.data;

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout options" }, { status: 400 });
  }
  const { planId, billingPeriod } = parsed.data;

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
      customer_email: email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: uid, planId },
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: uid, planId },
      },
      success_url: `${origin}/plans?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
