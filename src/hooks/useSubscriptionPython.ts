/**
 * Subscription view backed by the Python Postgres API.
 * Stripe is still the source of truth for billing; this is a read mirror.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";

export interface PythonSubscription {
  plan: "free" | "standard" | "premium";
  status: "active" | "trialing" | "canceled" | "past_due" | "none";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
}

const DEFAULT_SUB: PythonSubscription = { plan: "free", status: "none" };
const POLL_MS = 60000;

export function usePythonSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<PythonSubscription>(DEFAULT_SUB);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setSubscription(DEFAULT_SUB);
      setLoading(false);
      return;
    }
    const fetchSub = async () => {
      try {
        const data = await pythonFetch<{ subscription: PythonSubscription | null }>(
          "/subscription"
        );
        setSubscription(data.subscription || DEFAULT_SUB);
      } catch (err) {
        console.error("[subscription/python] fetch failed:", err);
        setSubscription(DEFAULT_SUB);
      } finally {
        setLoading(false);
      }
    };
    void fetchSub();
    if (useHttpTransport()) {
      const poll = setInterval(() => void fetchSub(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [user]);

  const isPaid = subscription.status === "active" || subscription.status === "trialing";
  const hasStandard = isPaid && (subscription.plan === "standard" || subscription.plan === "premium");
  const hasPremium = isPaid && subscription.plan === "premium";

  return { subscription, loading, isPaid, hasStandard, hasPremium };
}
