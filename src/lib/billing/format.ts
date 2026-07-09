/** Format subscription renewal / period end for display. */
export function formatBillingDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPlanLabel(plan: string): string {
  if (plan === "premium") return "Premium";
  if (plan === "standard") return "Standard";
  return "Free";
}

export function formatSubscriptionStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Free trial",
    canceled: "Canceled",
    past_due: "Past due",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    none: "No subscription",
  };
  return labels[status] ?? status;
}

export function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-green-500/15 text-green-300 border-green-500/25";
  if (status === "trialing") return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (status === "past_due" || status === "unpaid") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (status === "canceled") return "bg-gray-500/15 text-gray-400 border-gray-500/25";
  return "bg-white/10 text-gray-400 border-white/10";
}
