"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSyncQueue } from "@/hooks/offline/useOfflineSyncQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineSyncBadge() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, syncNow } = useOfflineSyncQueue();

  if (pendingCount === 0 && isOnline) return null;

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={!isOnline || isSyncing}
      className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50 focus-ring"
      title={isOnline ? "Sync pending changes" : "Offline — changes queued"}
    >
      {isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      <span>{pendingCount > 0 ? `${pendingCount} pending` : "Offline"}</span>
    </button>
  );
}
