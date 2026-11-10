"use client";

import { useEffect, useState } from "react";
import { Pause, Play, X, Hourglass } from "lucide-react";

export interface SyncHold {
  targetTime: number;
  releaseAt: number;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Live countdown to a wall-clock timestamp, ticking twice a second. */
function useCountdown(targetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [targetMs]);
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}

/**
 * Host card: park everyone on the host frame, then release both sides at
 * the same moment. The guest never taps anything, so provider ad scripts
 * have nothing to hijack.
 */
export function HostSyncCard({
  stage,
  onStart,
  onReleaseNow,
  onCancel,
}: {
  stage: SyncHold | null;
  onStart: () => void;
  onReleaseNow: () => void;
  onCancel: () => void;
}) {
  const countdown = useCountdown(stage?.releaseAt ?? 0);

  if (!stage) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[2.75rem] rounded-xl text-sm font-semibold transition-colors bg-sky-600/20 hover:bg-sky-600/35 text-sky-200 border border-sky-500/30"
      >
        <Pause className="w-4 h-4" />
        Pause + sync everyone to me
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
        <Hourglass className="w-4 h-4 animate-pulse" />
        Holding everyone at {formatClock(stage.targetTime)}
        <span className="ml-auto tabular-nums text-sky-300">{countdown}s</span>
      </div>
      <p className="mt-1 text-xs text-sky-200/70">
        Guests stay paused on this exact frame. Auto-starts together, or release now.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onReleaseNow}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-2 py-2 text-xs font-bold text-white transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Start together now
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-2 text-xs font-semibold text-gray-300 border border-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Guest banner: the host parked playback — sit tight, don't touch the
 * video (any tap can trigger provider popups). Sync is fully automatic.
 */
export function GuestStagingBanner({ staging }: { staging: SyncHold }) {
  const countdown = useCountdown(staging.releaseAt);

  return (
    <div className="mx-3 mt-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
        <Pause className="w-4 h-4" />
        Host is lining up the video…
        {staging.releaseAt > 0 && (
          <span className="ml-auto tabular-nums text-sky-300">{countdown}s</span>
        )}
      </div>
      <p className="mt-1 text-xs text-sky-200/70">
        Parked at {formatClock(staging.targetTime)} — don&apos;t touch the video,
        it starts together automatically.
      </p>
    </div>
  );
}
