"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, PartyPopper, Wifi } from "lucide-react";
import {
  getGuestJoinBridgeState,
  subscribeGuestJoinBridge,
  type GuestJoinBridgePhase,
} from "@/lib/party/guestJoinBridge";

const PHASE_LABEL: Record<Exclude<GuestJoinBridgePhase, "idle" | "error">, string> = {
  accepting: "Confirming your invite…",
  joining: "Securing your seat in the party…",
  resolving: "Finding the host's stream…",
  prefetching: "Pre-loading video for instant sync…",
  navigating: "Launching watch room…",
};

const PHASE_PROGRESS: Record<Exclude<GuestJoinBridgePhase, "idle" | "error">, number> = {
  accepting: 18,
  joining: 38,
  resolving: 55,
  prefetching: 72,
  navigating: 90,
};

function GuestJoinOverlayContent() {
  const bridge = useSyncExternalStore(
    subscribeGuestJoinBridge,
    getGuestJoinBridgeState,
    () => ({ phase: "idle" as const })
  );

  if (bridge.phase === "idle") return null;

  const isError = bridge.phase === "error";
  const phase = bridge.phase;
  const progress = isError ? 0 : PHASE_PROGRESS[phase as keyof typeof PHASE_PROGRESS] ?? 10;
  const label = isError
    ? bridge.error || "Could not join the party"
    : PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? "Joining watch party…";

  return (
    <div className="guest-join-overlay" role="alertdialog" aria-modal="true" aria-busy={!isError}>
      <div className="guest-join-overlay-card">
        <div className="guest-join-overlay-icon">
          {isError ? (
            <AlertCircle className="w-8 h-8 text-red-300" />
          ) : (
            <PartyPopper className="w-8 h-8 text-white" />
          )}
        </div>
        <h2 className="guest-join-overlay-title">
          {bridge.movieTitle ? `Joining ${bridge.movieTitle}` : "Joining watch party"}
        </h2>
        {bridge.hostName && !isError && (
          <p className="guest-join-overlay-host">
            <Wifi className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
            Hosted by {bridge.hostName}
          </p>
        )}
        <p className="guest-join-overlay-status">{label}</p>
        {!isError && (
          <>
            <div className="guest-join-overlay-bar" aria-hidden>
              <div className="guest-join-overlay-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <Loader2 className="guest-join-overlay-spinner w-5 h-5 text-red-400" />
          </>
        )}
      </div>
    </div>
  );
}

export default function GuestJoinOverlay() {
  if (typeof document === "undefined") return null;
  return createPortal(<GuestJoinOverlayContent />, document.body);
}
