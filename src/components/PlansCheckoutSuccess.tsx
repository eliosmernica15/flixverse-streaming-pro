"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/firebase/clientAuth";
import { formatPlanLabel } from "@/lib/billing/format";

/** Confirms Stripe checkout on return via server session verification. */
export function PlansCheckoutSuccess() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const confirmedRef = useRef(false);

  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success !== "1" || !sessionId || !user || confirmedRef.current) return;

    confirmedRef.current = true;
    setState("loading");

    async function confirm() {
      try {
        const headers = await getAuthHeaders(user);
        const res = await fetch(`/api/billing/session?session_id=${sessionId}`, { headers });
        const data = await res.json();

        if (!res.ok) {
          setState("error");
          toast({
            title: "Could not confirm subscription",
            description: data.error || "Please contact support if you were charged.",
            variant: "destructive",
          });
          return;
        }

        const planLabel = formatPlanLabel(data.planId || "standard");
        setState("done");
        toast({
          title: `Welcome to FlixVerse ${planLabel}!`,
          description: "Your subscription is active. Enjoy all features.",
        });
      } catch {
        setState("error");
        toast({
          title: "Could not confirm subscription",
          description: "Your payment may still be processing. Check Profile → Billing shortly.",
          variant: "destructive",
        });
      }
    }

    void confirm();
  }, [searchParams, user, toast]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Activating your subscription…
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-green-400 text-sm">
        <CheckCircle2 className="w-5 h-5" />
        Subscription activated successfully.
      </div>
    );
  }

  return null;
}
