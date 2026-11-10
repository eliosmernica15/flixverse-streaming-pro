"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PTTState } from "@/components/player/PTTIndicator";

/**
 * usePushToTalk — manages push-to-talk (PTT) state for a party mic.
 *
 * Two modes:
 *  - "hold" (default): mic is live only while the key is held.
 *  - "latch": press once to toggle live, press again to mute.
 *
 * The hook does NOT touch the MediaStream directly; it reports state changes
 * via `onStateChange` so the caller can mute/unmute the track. This keeps the
 * hook pure and testable.
 *
 * Usage:
 *   const { state, isLive } = usePushToTalk({
 *     enabled: micOn,
 *     mode: "hold",
 *     onStateChange: (live) => setMicLive(live),
 *   });
 */

export type PTMode = "hold" | "latch";

export interface UsePushToTalkOptions {
  /** Whether PTT is enabled at all. When false, the hook is a no-op. */
  enabled?: boolean;
  /** "hold" (default) or "latch". */
  mode?: PTMode;
  /** Key code to listen for. Defaults to "Space". */
  key?: string;
  /** Called whenever the live state changes. */
  onStateChange?: (live: boolean) => void;
  /** Called when PTT is engaged (for sound/haptic feedback). */
  onEngage?: () => void;
  /** Called when PTT is released. */
  onRelease?: () => void;
}

export interface UsePushToTalkResult {
  state: PTTState;
  isLive: boolean;
  /** Programmatically engage/disengage (for UI buttons). */
  engage: () => void;
  release: () => void;
  toggle: () => void;
}

export function usePushToTalk({
  enabled = true,
  mode = "hold",
  key = "Space",
  onStateChange,
  onEngage,
  onRelease,
}: UsePushToTalkOptions = {}): UsePushToTalkResult {
  const [state, setState] = useState<PTTState>("idle");
  const stateRef = useRef<PTTState>("idle");
  const engagedRef = useRef(false);

  const setLive = useCallback(
    (live: boolean, locked = false) => {
      const next: PTTState = live ? (locked ? "locked" : "listening") : "idle";
      if (stateRef.current === next) return;
      stateRef.current = next;
      setState(next);
      onStateChange?.(live);
      if (live) onEngage?.();
      else onRelease?.();
    },
    [onStateChange, onEngage, onRelease]
  );

  const engage = useCallback(() => {
    if (!enabled) return;
    engagedRef.current = true;
    setLive(true, mode === "latch");
  }, [enabled, mode, setLive]);

  const release = useCallback(() => {
    if (!enabled) return;
    if (mode === "latch") return; // latch toggles; release is a no-op
    engagedRef.current = false;
    setLive(false);
  }, [enabled, mode, setLive]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (engagedRef.current) {
      engagedRef.current = false;
      setLive(false);
    } else {
      engagedRef.current = true;
      setLive(true, true);
    }
  }, [enabled, setLive]);

  useEffect(() => {
    if (!enabled) return;
    const targetKey = key;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code !== targetKey && e.key !== " ") return;
      if (e.repeat) return;
      e.preventDefault();
      if (mode === "hold") engage();
      else toggle();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== targetKey && e.key !== " ") return;
      if (mode === "hold") release();
    };

    // Safety: release on blur so a held key doesn't stick.
    const onBlur = () => {
      if (mode === "hold" && engagedRef.current) release();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, key, mode, engage, release, toggle]);

  // Reset when disabled.
  useEffect(() => {
    if (!enabled && stateRef.current !== "idle") {
      engagedRef.current = false;
      setLive(false);
    }
  }, [enabled, setLive]);

  return {
    state,
    isLive: state === "listening" || state === "locked",
    engage,
    release,
    toggle,
  };
}

export default usePushToTalk;
