"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";

export function PlansCheckoutCanceled() {
  const searchParams = useSearchParams();
  if (searchParams.get("canceled") !== "1") return null;

  return (
    <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
      <XCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-200">Checkout canceled</p>
        <p className="text-amber-200/70 mt-1">
          No charge was made.{" "}
          <Link href="/plans" className="underline hover:text-white">
            Try again
          </Link>{" "}
          when you&apos;re ready.
        </p>
      </div>
    </div>
  );
}
