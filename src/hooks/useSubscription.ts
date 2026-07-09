"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";

export type SubscriptionPlan = "free" | "standard" | "premium";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "none";

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
}

const DEFAULT_SUB: UserSubscription = { plan: "free", status: "none" };

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription>(DEFAULT_SUB);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(DEFAULT_SUB);
      setLoading(false);
      return;
    }

    try {
      const db = requireFirebaseDb();
      const unsub = onSnapshot(
        doc(db, "subscriptions", user.uid),
        (snap) => {
          if (!snap.exists()) {
            setSubscription(DEFAULT_SUB);
          } else {
            const d = snap.data();
            setSubscription({
              plan: (d.plan as SubscriptionPlan) || "free",
              status: (d.status as SubscriptionStatus) || "none",
              stripeCustomerId: d.stripeCustomerId,
              stripeSubscriptionId: d.stripeSubscriptionId,
              currentPeriodEnd: d.currentPeriodEnd,
            });
          }
          setLoading(false);
        },
        () => {
          setSubscription(DEFAULT_SUB);
          setLoading(false);
        }
      );
      return unsub;
    } catch {
      setSubscription(DEFAULT_SUB);
      setLoading(false);
    }
  }, [user]);

  const isPaid = subscription.status === "active" || subscription.status === "trialing";
  const hasStandard = isPaid && (subscription.plan === "standard" || subscription.plan === "premium");
  const hasPremium = isPaid && subscription.plan === "premium";

  return { subscription, loading, isPaid, hasStandard, hasPremium };
}
