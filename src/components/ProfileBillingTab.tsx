"use client";

import Link from "next/link";
import { Check, CreditCard, Crown, Sparkles, Zap } from "lucide-react";
import { SubscriptionBilling } from "@/components/SubscriptionBilling";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "Unlimited browsing",
    "Watch history",
    "Personalized recommendations",
    "1 profile",
  ],
  standard: [
    "Everything in Free",
    "FlixParty co-watching",
    "Timeline comments",
    "Up to 3 profiles",
    "HD quality & offline caching",
  ],
  premium: [
    "Everything in Standard",
    "Up to 5 profiles",
    "Kids profiles & parental controls",
    "4K quality & ambient glow",
    "Spoiler guard",
  ],
};

/** Full billing tab on the profile page. */
export function ProfileBillingTab() {
  const { subscription, isPaid, hasPremium } = useSubscription();
  const features = PLAN_FEATURES[subscription.plan] ?? PLAN_FEATURES.free;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <SubscriptionBilling />

      <section className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-1">Your plan includes</h3>
        <p className="text-sm text-gray-500 mb-4">
          Features unlocked on your current {subscription.plan} plan
        </p>
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-300">
              <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      {(!isPaid || !hasPremium) && (
        <section className="glass-card rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center border border-white/10">
              {!isPaid ? (
                <Sparkles className="w-5 h-5 text-red-400" />
              ) : (
                <Crown className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {!isPaid ? "Unlock more with Standard" : "Go Premium"}
              </h3>
              <p className="text-sm text-gray-500">
                {!isPaid
                  ? "FlixParty, timeline comments, and HD streaming"
                  : "4K, kids profiles, and the full premium experience"}
              </p>
            </div>
          </div>
          <Button asChild className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400">
            <Link href="/plans">
              <Zap className="w-4 h-4 mr-2" />
              Compare all plans
            </Link>
          </Button>
        </section>
      )}

      <p className="text-xs text-gray-600 flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5" />
        Payments are processed securely by Stripe. Cancel anytime from Manage billing.
      </p>
    </div>
  );
}
