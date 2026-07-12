"use client";

import { useEffect, useState } from "react";
import { Loader2, PartyPopper, Radio, Wifi } from "lucide-react";

export type GuestSplashPhase =
  | "joining"
  | "loading"
  | "syncing"
  | "ready";

const PHASE_COPY: Record<GuestSplashPhase, string> = {
  joining: "Joining the watch party…",
  loading: "Preparing your video…",
  syncing: "Syncing with the host…",
  ready: "You're in sync — enjoy!",
};

const PHASE_STEP: Record<GuestSplashPhase, number> = {
  joining: 1,
  loading: 2,
  syncing: 3,
  ready: 4,
};

interface PartyGuestSplashProps {
  phase: GuestSplashPhase;
  title?: string;
  hostName?: string;
  driftMs?: number;
  visible: boolean;
}

export function PartyGuestSplash({
  phase,
  title,
  hostName,
  driftMs,
  visible,
}: PartyGuestSplashProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!visible && phase === "ready") {
      setExiting(true);
      const t = window.setTimeout(() => setExiting(false), 450);
      return () => window.clearTimeout(t);
    }
    setExiting(false);
  }, [visible, phase]);

  if (!visible && !exiting) return null;

  const progress =
    phase === "joining" ? 25 : phase === "loading" ? 55 : phase === "syncing" ? 82 : 100;
  const step = PHASE_STEP[phase];
  const syncQuality =
    driftMs !== undefined && driftMs < 800
      ? "excellent"
      : driftMs !== undefined && driftMs < 2000
        ? "good"
        : "aligning";

  return (
    <div
      className={`party-guest-splash ${exiting ? "party-guest-splash--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={phase !== "ready"}
    >
      <div className="party-guest-splash-card">
        <div className="party-guest-splash-steps" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`party-guest-splash-step ${n <= step ? "is-active" : ""} ${n < step ? "is-done" : ""}`}
            />
          ))}
        </div>
        <div className="party-guest-splash-icon">
          <PartyPopper className="w-8 h-8 text-white" />
        </div>
        <h2 className="party-guest-splash-title">
          {title ? `Joining ${title}` : "Joining watch party"}
        </h2>
        {hostName && (
          <p className="party-guest-splash-host">
            <Wifi className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
            Syncing with {hostName}
          </p>
        )}
        <p className="party-guest-splash-status">{PHASE_COPY[phase]}</p>
        <div className="party-guest-splash-bar" aria-hidden>
          <div className="party-guest-splash-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        {phase === "syncing" && (
          <p className="party-guest-splash-drift">
            <Radio className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
            {syncQuality === "excellent"
              ? `Locked in — ${Math.round(driftMs ?? 0)}ms drift`
              : syncQuality === "good"
                ? `Nearly aligned — ${Math.round(driftMs ?? 0)}ms`
                : "Matching host playback…"}
          </p>
        )}
        {phase !== "ready" && (
          <Loader2 className="party-guest-splash-spinner w-5 h-5 text-red-400" />
        )}
      </div>
    </div>
  );
}
