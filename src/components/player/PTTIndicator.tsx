"use client";

import { Mic, MicOff, Hand } from "lucide-react";

/**
 * PTTIndicator — visual feedback for push-to-talk (PTT) state.
 *
 * States:
 *  - `idle`: PTT not engaged, mic follows normal toggle.
 *  - `listening`: key held, mic is live (transmitting).
 *  - `locked`: PTT latch mode (toggle), mic live.
 *
 * Designed to sit next to the mic button in `PartyMediaControls` and in the
 * party sidebar. Animates a pulsing ring while transmitting so the user gets
 * immediate tactile/visual confirmation that they are on-air.
 */

export type PTTState = "idle" | "listening" | "locked";

export interface PTTIndicatorProps {
  state: PTTState;
  /** Whether the underlying mic is currently muted by the host. */
  hostMuted?: boolean;
  /** Optional keyboard hint (e.g. "Space"). */
  shortcut?: string;
  /** Compact mode for tight layouts. */
  compact?: boolean;
  className?: string;
}

export function PTTIndicator({
  state,
  hostMuted = false,
  shortcut = "Space",
  compact = false,
  className = "",
}: PTTIndicatorProps) {
  const isLive = state === "listening" || state === "locked";
  const isLocked = state === "locked";

  return (
    <div
      className={`ptt-indicator ${isLive ? "ptt-indicator--live" : ""} ${isLocked ? "ptt-indicator--locked" : ""} ${compact ? "ptt-indicator--compact" : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={
        hostMuted
          ? "Microphone muted by host"
          : isLive
            ? "Transmitting"
            : "Push to talk"
      }
    >
      <span className="ptt-indicator-icon" aria-label={hostMuted ? "Microphone muted by host" : isLive ? (isLocked ? "Locked transmitting" : "Transmitting microphone") : "Push to talk ready"}>
        {hostMuted ? (
          <MicOff className="w-3.5 h-3.5" />
        ) : isLive ? (
          <Mic className="w-3.5 h-3.5" />
        ) : (
          <Hand className="w-3.5 h-3.5" />
        )}
      </span>
      {!compact && (
        <span className="ptt-indicator-label">
          {hostMuted ? "Muted by host" : isLive ? (isLocked ? "On (locked)" : "Transmitting") : "Push to talk"}
        </span>
      )}
      {!compact && !isLive && !hostMuted && (
        <kbd className="ptt-indicator-kbd">{shortcut}</kbd>
      )}
      {isLive && <span className="ptt-indicator-ring" aria-hidden />}
    </div>
  );
}

export default PTTIndicator;
