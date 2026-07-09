"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/** Confirms Stripe checkout on return and writes subscription to Firestore. */
export function PlansCheckoutSuccess() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success !== "1" || !sessionId || !user) return;

    async function confirm() {
      try {
        const res = await fetch(`/api/billing/session?session_id=${sessionId}`);
        const data = await res.json();
        if (!res.ok) return;

        const db = requireFirebaseDb();
        await setDoc(
          doc(db, "subscriptions", user.uid),
          {
            plan: data.planId || "standard",
            status: data.status || "trialing",
            stripeCustomerId: data.customerId,
            stripeSubscriptionId: data.subscriptionId,
            updatedAt: Date.now(),
          },
          { merge: true }
        );

        toast({
          title: "Welcome to FlixVerse Premium!",
          description: "Your subscription is active. Enjoy all features.",
        });
      } catch {
        // Stripe may not be configured — silent fail
      }
    }

    void confirm();
  }, [searchParams, user, toast]);

  return null;
}
