"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-16 z-[60] px-4">
      <div className="glass-strong mx-auto flex max-w-lg items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-4 py-2.5 text-sm font-medium text-amber-200 shadow-lg shadow-amber-500/10 animate-fade-in backdrop-blur-md pointer-events-auto">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>You&apos;re offline — cached pages &amp; posters still work</span>
      </div>
    </div>
  );
}
