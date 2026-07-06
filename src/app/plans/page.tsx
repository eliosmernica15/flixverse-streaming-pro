import { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, Crown, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Plans — FlixVerse",
  description: "Choose the FlixVerse plan that works for you.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "from-gray-500 to-gray-600",
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
  },
  {
    name: "Standard",
    price: "$9.99",
    period: "/month",
    icon: Sparkles,
    color: "from-red-500 to-orange-600",
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
  },
  {
    name: "Premium",
    price: "$15.99",
    period: "/month",
    icon: Crown,
    color: "from-yellow-500 to-amber-600",
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
  },
];

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-3">
            Choose Your Plan
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Start for free, upgrade when you want more. All plans include unlimited browsing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] ${
                plan.popular
                  ? "border-red-500/50 bg-zinc-900 shadow-2xl shadow-red-500/10"
                  : "border-white/10 bg-zinc-950"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              )}

              <div className="p-6 lg:p-8">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>

                <h2 className="text-xl font-bold text-white mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.popular
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          All paid plans include a 7-day free trial. Cancel anytime. No charges during trial.
        </p>
      </div>
    </div>
  );
}
