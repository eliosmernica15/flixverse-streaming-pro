import { Metadata } from "next";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import PlansPricing from "@/components/PlansPricing";
import { PlansCheckoutSuccess } from "@/components/PlansCheckoutSuccess";
import { PlansCheckoutCanceled } from "@/components/PlansCheckoutCanceled";

export const metadata: Metadata = {
  title: "Plans — FlixVerse",
  description: "Choose the FlixVerse plan that works for you.",
};

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-5xl mx-auto">
        <SectionHeader eyebrow="Pricing" title="Choose Your Plan" />
        <p className="text-gray-400 text-base sm:text-lg max-w-2xl text-balance mb-12">
          Start for free, upgrade when you want more. All plans include unlimited browsing.
        </p>
        <PlansPricing />
        <Suspense fallback={null}>
          <PlansCheckoutCanceled />
          <PlansCheckoutSuccess />
        </Suspense>
      </div>
    </div>
  );
}
