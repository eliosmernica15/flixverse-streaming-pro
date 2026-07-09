"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/Reveal";

type Plan = {
  name: string;
  subtitle: string;
  icon: typeof Zap;
  accent: string;
  features: string[];
  cta: string;
  href: string;
  popular: boolean;
  monthly: number;
  yearly: number;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    subtitle: "For casual viewers",
    icon: Zap,
    accent: "from-slate-400 to-slate-600",
    features: [
      "Unlimited browsing",
      "Watch history tracking",
      "Personalized recommendations",
      "Up to 1 profile",
      "Standard video quality",
    ],
    cta: "Get Started",
    href: "/auth",
    popular: false,
    monthly: 0,
    yearly: 0,
  },
  {
    name: "Standard",
    subtitle: "For everyday streaming",
    icon: Sparkles,
    accent: "from-red-500 to-orange-600",
    features: [
      "Everything in Free",
      "FlixParty co-watching",
      "Timeline comments",
      "Up to 3 profiles",
      "HD video quality",
      "Offline caching",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/auth",
    popular: true,
    monthly: 9.99,
    yearly: 99.99,
  },
  {
    name: "Premium",
    subtitle: "The ultimate experience",
    icon: Crown,
    accent: "from-yellow-500 to-amber-600",
    features: [
      "Everything in Standard",
      "Up to 5 profiles",
      "Kids profiles with parental controls",
      "4K video quality",
      "Ambient glow effects",
      "Spoiler guard",
      "Early access to new features",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/auth",
    popular: false,
    monthly: 15.99,
    yearly: 159.99,
  },
];

export function PlansPricing() {
  const [yearly, setYearly] = useState(false);

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
            Monthly
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
            Yearly
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/15">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      <Reveal className="stagger grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const price = plan.monthly === 0 ? "$0" : yearly ? `$${plan.yearly}` : `$${plan.monthly}`;
          const period = plan.monthly === 0 ? "forever" : yearly ? "/year" : "/month";
          return (
            <div key={plan.name} className={`relative rounded-2xl p-[1px] ${plan.popular ? "gradient-border" : ""}`}>
              <div
                className={`h-full rounded-2xl p-6 lg:p-8 flex flex-col ${
                  plan.popular ? "surface-elevated glow-ring" : "glass-panel"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="gradient" className="shadow-lg">
                      Most Popular
                    </Badge>
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

                <Button asChild variant="gradient" className="w-full min-h-[44px]">
                  <Link href={plan.href}>
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </Reveal>

      <p className="text-center text-gray-500 text-xs mt-10">
        All paid plans include a 7-day free trial. Cancel anytime. No charges during trial.
      </p>
    </div>
  );
}

export default PlansPricing;
