"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useDominantColors } from "@/hooks/player/useDominantColors";
import {
  rgbToCss,
  type RGBColor,
} from "@/lib/player/extractDominantColors";
import {
  ScreenBloomSampler,
  simulatedFrame,
  type BloomFrame,
} from "@/lib/player/screenBloom";

/**
 * **4D screen bloom.**
 *
 * Projects the colour of what is on screen onto the space around the
 * player, so the viewer's room becomes an extension of the film. Renders
 * three layers:
 *
 *  - a wide, heavily blurred colour field (the "wall wash")
 *  - two directional light emitters that counter-drift for depth
 *  - a fine grain overlay that keeps large gradients from banding
 *
 * The colour source escalates automatically: live video sampling when a
 * readable `<video>` exists, otherwise a deterministic simulated walk over
 * the title's palette. See `screenBloom.ts` for why cross-origin embeds
 * cannot be sampled directly.
 *
 * Everything is opt-out via `flixverse-ambient-glow` and fully disabled for
 * reduced-motion users.
 */

interface CinemaBloomProps {
  posterPath: string | null;
  genreIds?: number[];
  /** Current playback position — drives the simulated drift. */
  playbackSeconds: number;
  /** Playing vs paused — paused holds a static, dimmer palette. */
  isPlaying: boolean;
  isActive: boolean;
  /** A same-origin <video> to sample, when one exists. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** 0–1 strength multiplier from user settings. */
  intensity?: number;
}

const FRAME_INTERVAL_MS = 125; // 8 Hz — above this it is imperceptible, below it feels laggy
const STORAGE_KEY = "flixverse-ambient-glow";
const INTENSITY_KEY = "flixverse-bloom-intensity";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function CinemaBloom({
  posterPath,
  genreIds,
  playbackSeconds: _playbackSeconds,
  isPlaying,
  isActive,
  videoRef,
  intensity = 1,
}: CinemaBloomProps) {
  const reducedMotion = useReducedMotion();
  const { colors } = useDominantColors(posterPath, genreIds);
  const [enabled, setEnabled] = useState(true);
  const [frame, setFrame] = useState<BloomFrame | null>(null);
  const samplerRef = useRef<ScreenBloomSampler | null>(null);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  // Rebuild the sampler when the video element identity changes. Providers
  // remount the iframe on every server switch; a same-origin trailer or
  // self-hosted source surfaces a fresh <video> here.
  const video = videoRef?.current ?? null;
  useEffect(() => {
    samplerRef.current = video ? new ScreenBloomSampler(video) : null;
  }, [video]);

  // Settings sync — same storage key and event as the pre-existing ambient
  // glow so the user's toggle keeps working across both implementations.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabled(stored !== "false");
    } catch {
      // storage unavailable — keep the default
    }
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      if (detail && typeof detail.enabled === "boolean") setEnabled(detail.enabled);
    };
    window.addEventListener("toggle-ambient-glow", onToggle);
    return () => window.removeEventListener("toggle-ambient-glow", onToggle);
  }, []);

  const active = isActive && enabled && !reducedMotion;

  // While playing, the loop only needs the current position — read it on
  // demand from a ref so the effect above does not restart 4×/second.
  const playbackRef = useRef(_playbackSeconds);
  playbackRef.current = _playbackSeconds;

  // Drive the frame loop. Parked while inactive or paused-on-a-static-frame.
  //
  // The loop deliberately does NOT depend on `isPlaying`: it reads the live
  // value from a ref. Previously `isPlaying` was in the dependency list, so a
  // pause built a `simulatedFrame(0, …)` and the next play rebuilt it from
  // `playbackSeconds` captured at effect-creation time — the tint froze at
  // whatever second the effect last re-ran and never caught up with the film.
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  useEffect(() => {
    if (!active) {
      setFrame(null);
      return;
    }

    const tick = (now: number) => {
      if (now - lastTickRef.current < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      const live = samplerRef.current?.sample(now) ?? null;
      if (live) {
        setFrame(live);
      } else if (playingRef.current) {
        setFrame(simulatedFrame(playbackRef.current, colors as RGBColor[]));
      } else {
        // Paused: hold a quiet palette-derived frame instead of animating.
        const held = simulatedFrame(0, colors as RGBColor[]);
        setFrame({ ...held, luminance: held.luminance * 0.55, source: "palette" });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // `colors` is stable per poster; re-running on every 0.25s clock tick
    // would reset the loop needlessly.
  }, [active, colors]);

  // A paused film does not need a 8 Hz loop: once the held frame is painted,
  // stop scheduling. Waking happens when `isPlaying` flips, because the
  // effect above re-runs on the next colour change and the loop resumes as
  // soon as we are active again.
  useEffect(() => {
    if (!active || isPlaying) return;
    setFrame((prev) => {
      if (!prev) {
        const held = simulatedFrame(0, colors as RGBColor[]);
        return { ...held, luminance: held.luminance * 0.55, source: "palette" };
      }
      return prev;
    });
  }, [active, isPlaying, colors]);

  const style = useMemo(() => {
    if (!frame) return null;

    const strength = clamp01(intensity) * (0.55 + frame.luminance * 0.75);
    // A dark scene should still cast a visible glow; a bright one should not
    // blow out. This curve keeps the perceived intensity roughly constant.
    const alpha = 0.16 + strength * 0.3;

    const p = frame.primary;
    const s = frame.secondary;

    return {
      background: `
        radial-gradient(60% 70% at 18% 28%, ${rgbToCss(p, alpha)} 0%, transparent 62%),
        radial-gradient(55% 65% at 82% 30%, ${rgbToCss(s, alpha * 0.8)} 0%, transparent 60%),
        radial-gradient(80% 80% at 50% 92%, ${rgbToCss(p, alpha * 0.55)} 0%, transparent 70%)
      `,
      opacity: active ? 1 : 0,
    } as React.CSSProperties;
  }, [frame, intensity, active]);

  if (!active || !style) return null;

  return (
    <div className="cinema-bloom" aria-hidden="true">
      <div className="cinema-bloom-field" style={style} />
      <div className="cinema-bloom-emitter cinema-bloom-emitter--left" style={style} />
      <div className="cinema-bloom-emitter cinema-bloom-emitter--right" style={style} />
      <div className="cinema-bloom-grain" />
    </div>
  );
}

/** Read/write the persisted bloom intensity (0–1). */
export function getBloomIntensity(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(INTENSITY_KEY);
    if (raw === null) return 1;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : 1;
  } catch {
    return 1;
  }
}

export function setBloomIntensity(value: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTENSITY_KEY, String(clamp01(value)));
    window.dispatchEvent(
      new CustomEvent("toggle-ambient-glow", { detail: { enabled: value > 0 } })
    );
  } catch {
    // ignore
  }
}

export default CinemaBloom;
