"use client";

import { Radio, RadioTower, Wifi, WifiOff, Loader2, Signal, Activity } from "lucide-react";

export type SyncStatus =
  | "connected"
  | "connecting"
  | "drift"
  | "resyncing"
  | "disconnected";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  driftMs?: number;
  className?: string;
  /** Number of realtime events processed (telemetry). */
  processed?: number;
  /** Number of active peers (Firestore realtime + WebRTC). */
  peers?: number;
}

const STATUS_CONFIG: Record<SyncStatus, { label: string; tone: string; dot: string; icon: typeof Wifi }> = {
  connected: {
    label: "Synced",
    tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    icon: Signal,
  },
  connecting: {
    label: "Connecting",
    tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    icon: Radio,
  },
  drift: {
    label: "Re-syncing",
    tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    icon: Activity,
  },
  resyncing: {
    label: "Hard resync",
    tone: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    dot: "bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.7)]",
    icon: Loader2,
  },
  disconnected: {
    label: "Offline",
    tone: "text-red-300 bg-red-500/10 border-red-500/30",
    dot: "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    icon: WifiOff,
  },
};

export function SyncStatusBadge({ status, driftMs, processed, peers, className = "" }: SyncStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const driftLabel =
    driftMs !== undefined && (status === "drift" || status === "resyncing")
      ? `${driftMs > 0 ? "+" : ""}${Math.round(driftMs / 1000)}s`
      : null;

  const animateIcon =
    status === "connecting" || status === "drift" || status === "resyncing";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border ${config.tone} ${className}`}
      title={
        typeof processed === "number" || typeof peers === "number"
          ? `Events: ${processed ?? 0} · Peers: ${peers ?? 0}`
          : undefined
      }
    >
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`}>
        {status === "connected" && (
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
        )}
      </span>
      <Icon className={`w-3 h-3 ${animateIcon ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{config.label}</span>
      {driftLabel && (
        <span className="ml-0.5 opacity-70 tabular-nums">{driftLabel}</span>
      )}
    </span>
  );
}
