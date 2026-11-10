import type Stripe from "stripe";

/**
 * Stripe dahlia-API helpers.
 *
 * The 2026-06-24.dahlia API removed `Subscription.current_period_end`
 * (now `SubscriptionItem.current_period_end`) and moved the invoice →
 * subscription link to `Invoice.parent.subscription_details.subscription`.
 * These helpers centralize the new access patterns so call sites stop
 * silently falling back to bogus defaults.
 */

/** Max current_period_end across all subscription items (ms), or undefined. */
export function getSubscriptionPeriodEndMs(
  sub: Stripe.Subscription
): number | undefined {
  let maxEnd: number | undefined;
  for (const item of sub.items?.data ?? []) {
    const end = item?.current_period_end;
    if (typeof end === "number" && Number.isFinite(end)) {
      maxEnd = maxEnd === undefined ? end : Math.max(maxEnd, end);
    }
  }
  return maxEnd === undefined ? undefined : maxEnd * 1000;
}

/** Subscription id referenced by an invoice (dahlia parent.subscription_details). */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") return null;
  const sub = parent.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
