"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/Reveal";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/firebase/clientAuth";

type PlanId = "free" | "standard" | "premium";

type Plan = {
  id: PlanId;
  name: string;
  subtitle: string;
  icon: typeof Zap;
  accent: string;
  features: string[];
  cta: string;
  popular: boolean;
  monthly: number;
  yearly: number;
};

const PLAN_META: Record<
  PlanId,
  { icon: typeof Zap; accent: string; popular: boolean; monthly: number; yearly: number }
> = {
  free: {
    icon: Zap,
    accent: "from-slate-400 to-slate-600",
    popular: false,
    monthly: 0,
    yearly: 0,
  },
  standard: {
    icon: Sparkles,
    accent: "from-red-500 to-orange-600",
    popular: true,
    monthly: 9.99,
    yearly: 99.99,
  },
  premium: {
    icon: Crown,
    accent: "from-yellow-500 to-amber-600",
    popular: false,
    monthly: 15.99,
    yearly: 159.99,
  },
};

export function PlansPricing() {
  const t = useTranslations("plans");
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const { user } = useAuth();
  const { subscription, hasStandard, hasPremium } = useSubscription();
  const { toast } = useToast();
  const router = useRouter();

  const plans = useMemo<Plan[]>(() => {
    return (["free", "standard", "premium"] as PlanId[]).map((id) => {
      const meta = PLAN_META[id];
      const features = t.raw(`${id}.features`) as string[];
      return {
        id,
        name: t(`${id}.name`),
        subtitle: t(`${id}.subtitle`),
        cta: t(`${id}.cta`),
        features: Array.isArray(features) ? features : [],
        ...meta,
      };
    });
  }, [t]);

  const handleCheckout = async (plan: Plan) => {
    if (plan.id === "free") {
      router.push(user ? "/" : "/auth");
      return;
    }

    if (!user) {
      router.push("/auth?redirect=/plans");
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          planId: plan.id,
          billingPeriod: yearly ? "yearly" : "monthly",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: t("checkoutUnavailable"),
          description: data.error || t("stripeNotConfigured"),
          variant: "destructive",
        });
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: t("checkoutFailed"), variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    if (!user) return;
    const headers = await getAuthHeaders(user);
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const isCurrentPlan = (plan: Plan) => {
    if (plan.id === "free" && subscription.plan === "free") return true;
    if (plan.id === "standard" && hasStandard && !hasPremium) return true;
    if (plan.id === "premium" && hasPremium) return true;
    return false;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col items-center gap-3 mb-12">
        <div className="inline-flex items-center gap-1 p-1 rounded-full glass-panel">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all press-effect focus-ring min-h-[44px] ${
              !yearly
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("monthly")}
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all press-effect focus-ring min-h-[44px] inline-flex items-center gap-2 ${
              yearly
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("yearly")}
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/15">
              {t("save20")}
            </span>
          </button>
        </div>
        {subscription.stripeCustomerId && (
          <button
            type="button"
            onClick={handleManage}
            className="text-xs text-gray-400 hover:text-white underline"
          >
            {t("manageBilling")}
          </button>
        )}
      </div>

      <Reveal className="stagger grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = plan.monthly === 0 ? "$0" : yearly ? `$${plan.yearly}` : `$${plan.monthly}`;
          const period = plan.monthly === 0 ? t("forever") : yearly ? t("perYear") : t("perMonth");
          const current = isCurrentPlan(plan);
          return (
            <div key={plan.id} className={`relative rounded-2xl p-[1px] ${plan.popular ? "gradient-border" : ""}`}>
              <div
                className={`h-full rounded-2xl p-6 lg:p-8 flex flex-col ${
                  plan.popular ? "surface-elevated glow-ring" : "glass-panel"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="gradient" className="shadow-lg">
                      {t("mostPopular")}
                    </Badge>
                  </div>
                )}
                {current && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-600/90">{t("currentPlan")}</Badge>
                  </div>
                )}

                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.accent} flex items-center justify-center mb-4 shadow-lg`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                <p className="text-sm text-gray-400 mb-4">{plan.subtitle}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-white">{price}</span>
                  <span className="text-sm text-gray-500">{period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                        <Check className="h-3 w-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <Button asChild variant="gradient" className="w-full min-h-[44px]">
                    <Link href={user ? "/" : "/auth"}>
                      {plan.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="gradient"
                    className="w-full min-h-[44px]"
                    disabled={current || loadingPlan === plan.id}
                    onClick={() => handleCheckout(plan)}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : current ? (
                      t("currentPlan")
                    ) : (
                      <>
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Reveal>

      <p className="text-center text-gray-500 text-xs mt-10">
        {t("trialNote")}
      </p>
    </div>
  );
}

export default PlansPricing;
