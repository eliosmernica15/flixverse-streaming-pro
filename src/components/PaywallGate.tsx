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
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-xl">
        <div className="text-center p-6 max-w-xs">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">{feature}</h3>
          <p className="text-xs text-gray-400 mb-4">
            Upgrade to Standard or Premium to access this feature.
          </p>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
