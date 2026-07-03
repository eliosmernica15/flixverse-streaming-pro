"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-[60] px-4 pointer-events-none">
      <div className="max-w-lg mx-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm font-medium backdrop-blur-md shadow-lg animate-fade-in pointer-events-auto">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>You&apos;re offline — cached pages &amp; posters still work</span>
      </div>
    </div>
  );
}
