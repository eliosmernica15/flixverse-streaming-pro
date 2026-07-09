import type { SubscriptionPlan } from "@/hooks/useSubscription";

/** Max member profiles per plan (matches PlansPricing marketing). */
export function getMaxProfiles(plan: SubscriptionPlan): number {
  if (plan === "premium") return 5;
  if (plan === "standard") return 3;
  return 1;
}
