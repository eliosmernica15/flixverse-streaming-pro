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
  } | null;
}

/** List recent invoices for the authenticated subscriber. */
export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await callPythonJson<SubscriptionResponse>(request, "/subscription");
  if (sub.error) {
    return NextResponse.json(
      { error: "Failed to look up subscription" },
      { status: sub.status === 401 ? 401 : 502 }
    );
  }

  const customerId = sub.data?.subscription?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 8,
    });

    return NextResponse.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due,
        currency: inv.currency,
        created: inv.created ? inv.created * 1000 : null,
        periodEnd: inv.period_end ? inv.period_end * 1000 : null,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf,
      })),
    });
  } catch (err) {
    console.error("Invoice list error:", err);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
