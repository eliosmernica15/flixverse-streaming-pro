"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

interface PaywallGateProps {
  feature: string;
  children: React.ReactNode;
  /** If true, show the paywall. If false, render children normally. */
  locked?: boolean;
}

/**
 * Wraps premium content with a blur + upgrade prompt when locked.
 * Use around features that require Standard/Premium plan.
 */
export function PaywallGate({ feature, children, locked = false }: PaywallGateProps) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-[4px] pointer-events-none opacity-40 select-none">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px]">
        <div className="glass-panel animate-scale-in mx-auto max-w-xs rounded-2xl p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-orange-500/20">
            <Lock className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="mb-1 text-sm font-bold text-white">{feature}</h3>
          <p className="mb-4 text-xs text-gray-400">
            Upgrade to Standard or Premium to access this feature.
          </p>
          <Link
            href="/plans"
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white focus-ring"
          >
            <Sparkles className="h-3.5 w-3.5" />
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
