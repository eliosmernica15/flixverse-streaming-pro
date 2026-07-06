"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";

export type SyncStatus = "connected" | "connecting" | "drift" | "disconnected";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  driftMs?: number;
  className?: string;
}

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; icon: typeof Wifi }> = {
  connected: { label: "Synced", color: "text-green-400 bg-green-500/15 border-green-500/30", icon: Wifi },
  connecting: { label: "Connecting…", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Loader2 },
  drift: { label: "Re-syncing", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Loader2 },
  disconnected: { label: "Offline", color: "text-red-400 bg-red-500/15 border-red-500/30", icon: WifiOff },
};

export function SyncStatusBadge({ status, driftMs, className = "" }: SyncStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const driftLabel =
    driftMs !== undefined && status === "drift"
      ? `${driftMs > 0 ? "+" : ""}${Math.round(driftMs / 1000)}s`
      : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border ${config.color} ${className}`}
    >
      <Icon
        className={`w-3 h-3 ${status === "connecting" || status === "drift" ? "animate-spin" : ""}`}
      />
      {config.label}
      {driftLabel && (
        <span className="ml-0.5 opacity-70">{driftLabel}</span>
      )}
    </span>
  );
}
