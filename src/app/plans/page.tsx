import { Metadata } from "next";
import { Suspense } from "react";
import PlansPricing from "@/components/PlansPricing";
import { PlansCheckoutSuccess } from "@/components/PlansCheckoutSuccess";
import { PlansCheckoutCanceled } from "@/components/PlansCheckoutCanceled";
import { Sparkles, Check, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Plans — FlixVerse",
  description: "Choose the FlixVerse plan that works for you.",
};

const TRUST = [
  { icon: Check, label: "Cancel anytime" },
  { icon: Shield, label: "Secure billing" },
  { icon: Sparkles, label: "30-day money back" },
];

export default function PlansPage() {
  return (
    <div className="page-enter">
      <header className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239, 68, 68, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(251, 191, 36, 0.15) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 mb-3">
            <Sparkles className="h-3 w-3" />
            Pricing
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05] mb-3">
            Choose Your Plan
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto text-balance">
            Start for free, upgrade when you want more. All plans include unlimited browsing and zero ads.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {TRUST.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300"
              >
                <t.icon className="h-3 w-3 text-emerald-400" />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="pb-16 px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto">
        <PlansPricing />
        <Suspense fallback={null}>
          <PlansCheckoutCanceled />
          <PlansCheckoutSuccess />
        </Suspense>
      </div>
    </div>
  );
}
