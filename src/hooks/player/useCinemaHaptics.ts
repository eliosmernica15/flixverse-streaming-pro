"use client";

import { useEffect, useRef } from "react";
import { getGlobalAudioContext, getMasterGain } from "@/lib/player/audioSingleton";
import {
  fireHaptic,
  isHapticsEnabled,
  strengthForEnergy,
  type HapticStrength,
} from "@/lib/player/haptics";

interface UseCinemaHapticsOptions {
  enabled: boolean;
  /** A same-origin, CORS-clean video to analyse. Null for cross-origin embeds. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Explicit beats we *do* know about (seek, episode start, …). */
  transportEvent?: { kind: "play" | "pause" | "seek" | "episode"; at: number } | null;
}

interface AudioTap {
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Uint8Array;
}

/**
 * Cinematic haptics.
 *
 * Two honest signal paths, never a fabricated "explosion":
 *
 *  1. **Real audio transients** — when the player owns a same-origin
 *     `<video>` (trailers, self-hosted and offline sources), an analyser taps
 *     the low band and fires a pulse on genuine bass energy. Dialogue stays
 *     below the threshold and never buzzes.
 *  2. **Transport beats** — play, pause, seek and episode changes always
 *     produce a light pulse, which reads as tactile confirmation of the
 *     action the user just took.
 *
 * A cross-origin provider iframe exposes neither audio nor video to us, so
 * for those sources only path 2 runs. That is a deliberate choice: buzzing
 * at random during a quiet scene is worse than silence.
 */
export function useCinemaHaptics({
  enabled,
  videoRef,
  transportEvent,
}: UseCinemaHapticsOptions) {
  const tapRef = useRef<AudioTap | null>(null);
  const rafRef = useRef(0);
  const smoothedRef = useRef(0);

  // ── Path 1: real audio ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef?.current ?? null;
    if (!enabled || !video || !isHapticsEnabled()) {
      return;
    }

    let cancelled = false;
    const ctx = getGlobalAudioContext();
    const master = getMasterGain();
    if (!ctx || !master) return;

    let tap: AudioTap | null = null;
    try {
      // `createMediaElementSource` may only be called once per element for
      // the lifetime of the document. If the element was already tapped
      // (e.g. by a previous mount), this throws — treat it as "no tap".
      const source = ctx.createMediaElementSource(video);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      // Highpass off; we want the bass band. Connect through the master bus
      // so the element's audio still reaches the speakers.
      source.connect(analyser);
      analyser.connect(master);
      tap = {
        source,
        analyser,
        buffer: new Uint8Array(analyser.frequencyBinCount),
      };
      tapRef.current = tap;
    } catch {
      return;
    }

    const LOW_BINS = 12; // ≈ 0–500 Hz at fftSize 512 / 48 kHz
    /**
     * Analysing audio at 60 fps burns a full core for no benefit: the
     * perceptual band we react to (bass transients) changes at the tempo of
     * the score, not the refresh rate. 20 Hz is well past what the haptic
     * throttle can even deliver (220 ms minimum gap) while costing a third
     * of the frames.
     */
    const ANALYSIS_INTERVAL_MS = 50;
    let lastAnalysis = 0;

    const loop = (now: number) => {
      if (cancelled) return;
      const active = tapRef.current;
      if (!active) return;

      if (now - lastAnalysis >= ANALYSIS_INTERVAL_MS) {
        lastAnalysis = now;

        active.analyser.getByteFrequencyData(active.buffer);
        let sum = 0;
        for (let i = 0; i < LOW_BINS; i += 1) sum += active.buffer[i];
        const energy = sum / (LOW_BINS * 255);

        // Jump-scare / impact detection: a sudden energy spike (>= 0.35 in
        // one analysis window) fires a heavy pulse even if the smoothed
        // level would not have crossed the steady-state threshold.
        const prevEnergy = smoothedRef.current;
        const spike = energy - prevEnergy >= 0.35;

        // Attack fast, release slow — matches how loudness is perceived and
        // stops a single frame from firing two pulses.
        const smoothed =
          energy > smoothedRef.current
            ? energy
            : smoothedRef.current * 0.88 + energy * 0.12;
        smoothedRef.current = smoothed;

        if (spike) {
          fireHaptic("heavy");
        } else {
          const strength: HapticStrength | null = strengthForEnergy(smoothed);
          if (strength) fireHaptic(strength);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      const current = tapRef.current;
      tapRef.current = null;
      if (current) {
        try {
          current.source.disconnect();
          current.analyser.disconnect();
        } catch {
          // already detached
        }
      }
    };
  }, [enabled, videoRef]);

  // ── Path 2: transport beats ───────────────────────────────────────────
  //
  // Only *transitions* deserve a pulse. The caller derives its event from
  // `Math.floor(currentTime)`, which changes every second of playback — so
  // this effect used to fire a vibration burst once per second for the entire
  // film on any device with a motor, while the user sat still and watched.
  // Keying on (kind, at) cannot distinguish that from a real play/pause.
  const lastKindRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !transportEvent) return;
    if (transportEvent.kind === lastKindRef.current) return;
    lastKindRef.current = transportEvent.kind;
    fireHaptic(transportEvent.kind === "pause" ? "light" : "medium");
  }, [enabled, transportEvent]);
}

export default useCinemaHaptics;
