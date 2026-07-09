import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyAuthHeader } from "@/lib/firebase/verifyAuth";
import { getAdminDb } from "@/lib/firebase/admin";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: "2026-06-24.dahlia" });
}

export const runtime = "nodejs";

/** List recent invoices for the authenticated subscriber. */
export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const auth = await verifyAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const subSnap = await db.collection("subscriptions").doc(auth.uid).get();
  const customerId = subSnap.data()?.stripeCustomerId as string | undefined;
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
