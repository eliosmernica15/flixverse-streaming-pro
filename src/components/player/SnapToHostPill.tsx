"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

/** Drift (ms) above which a guest is offered a one-tap resync. */
export const SNAP_TO_HOST_THRESHOLD_MS = 2000;
/**
 * Drift must stay above the threshold this long before the pill appears.
 * The automatic soft-seek path usually closes a transient gap (a scrub, a
 * buffering hiccup) within a second; flashing a button for those would
 * train users to ignore it.
 */
const SHOW_AFTER_MS = 1800;
/** Hide the pill for this long after a tap so the resync can land. */
const COOLDOWN_AFTER_SNAP_MS = 6000;

export interface SnapToHostPillProps {
  /** Only guests in an active party ever see the pill. */
  active: boolean;
  driftMs: number;
  /** Projected host position (seconds), for the label. */
  getHostTime: () => number;
  /** Performs the resync. Returns the target time, or null if unavailable. */
  onSnap: () => number | null;
}

function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/**
 * Floating "⚡ Snap to Host" HUD pill.
 *
 * The automatic drift loop rate-limits iframe rebuilds so it can never trap a
 * guest in a reload loop — which means a large drift on a silent provider can
 * persist for up to the cooldown. This pill hands that decision to the user:
 * one tap snaps straight to the host's projected position.
 */
function SnapToHostPillImpl({ active, driftMs, getHostTime, onSnap }: SnapToHostPillProps) {
  const [visible, setVisible] = useState(false);
  const [hostLabel, setHostLabel] = useState("");
  const overSinceRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const over = active && driftMs >= SNAP_TO_HOST_THRESHOLD_MS;

  useEffect(() => {
    if (!over) {
      overSinceRef.current = 0;
      setVisible(false);
      return;
    }
    if (!overSinceRef.current) overSinceRef.current = Date.now();

    const evaluate = () => {
      const now = Date.now();
      if (now < cooldownUntilRef.current) return;
      if (now - overSinceRef.current < SHOW_AFTER_MS) return;
      setHostLabel(formatTimestamp(getHostTime()));
      setVisible(true);
    };
    evaluate();
    // Refresh the label once a second while shown; the host keeps moving.
    const id = window.setInterval(evaluate, 1000);
    return () => window.clearInterval(id);
  }, [over, getHostTime]);

  const handleSnap = useCallback(() => {
    const target = onSnap();
    if (target === null) return;
    cooldownUntilRef.current = Date.now() + COOLDOWN_AFTER_SNAP_MS;
    overSinceRef.current = 0;
    setVisible(false);
  }, [onSnap]);

  if (!visible) return null;

  const driftSeconds = Math.round(driftMs / 1000);

  return (
    <div className="snap-to-host" role="status" aria-live="polite">
      <span className="snap-to-host__label">
        {driftSeconds}s out of sync
      </span>
      <button
        type="button"
        className="snap-to-host__btn"
        onClick={handleSnap}
        aria-label={`Snap to host at ${hostLabel}`}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        Snap to Host
        <span className="snap-to-host__time">{hostLabel}</span>
      </button>
    </div>
  );
}

export const SnapToHostPill = memo(SnapToHostPillImpl);
