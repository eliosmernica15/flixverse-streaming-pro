/**
 * MicroSoundLibrary — synthetic audio bursts using Web Audio API (no external .mp3).
 *
 * All sounds share the app-wide singleton AudioContext. Creating a context
 * per sound exhausts the browser's 6-context budget within seconds of a
 * watch party (each reaction, scrub tick and hover would allocate one),
 * after which Web Audio throws and the UI sound engine dies silently.
 */

import { getGlobalAudioContext, getMasterGain } from "./audioSingleton";

export type MicroSoundType = "timeline-tick" | "cinematic-drop" | "reaction-pop" | "hover-click";

interface MicroSoundSpec {
  type: OscillatorType;
  from: number;
  to?: number;
  /** Duration in seconds. */
  duration: number;
  peak: number;
  /** Ramp shape for the tail. */
  curve: "exponential" | "linear";
}

const SPECS: Record<MicroSoundType, MicroSoundSpec> = {
  "timeline-tick": {
    type: "sine",
    from: 880,
    duration: 0.05,
    peak: 0.05,
    curve: "exponential",
  },
  "reaction-pop": {
    type: "sine",
    from: 1200,
    duration: 0.03,
    peak: 0.1,
    curve: "exponential",
  },
  "cinematic-drop": {
    type: "sine",
    from: 440,
    to: 110,
    duration: 0.2,
    peak: 0.08,
    curve: "linear",
  },
  "hover-click": {
    type: "triangle",
    from: 800,
    duration: 0.012,
    peak: 0.02,
    curve: "linear",
  },
};

const STORAGE_KEY = "flixverse-micro-sounds";

let enabledCache: boolean | null = null;

/** Micro sounds are opt-in: they layer on top of the movie audio. */
export function getMicroSoundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache !== null) return enabledCache;
  try {
    enabledCache = localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

export function setMicroSoundsEnabled(value: boolean): void {
  enabledCache = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

export function playMicroSound(type: MicroSoundType): void {
  if (typeof window === "undefined") return;
  if (!getMicroSoundsEnabled()) return;

  const ctx = getGlobalAudioContext();
  const out = getMasterGain();
  if (!ctx || !out) return;

  const spec = SPECS[type];
  if (!spec) return;

  try {
    const now = ctx.currentTime;
    const end = now + spec.duration;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.from, now);
    if (spec.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(spec.to, end);
    }

    // Exponential ramps cannot reach zero — start/end at a tiny epsilon.
    gain.gain.setValueAtTime(Math.max(spec.peak, 0.0001), now);
    if (spec.curve === "exponential") {
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      gain.gain.linearRampToValueAtTime(0, end);
    }

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(end + 0.01);

    // Release graph nodes once the sound has finished so a long session
    // does not accumulate thousands of detached oscillators.
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // already disconnected
      }
    };
  } catch {
    // Audio is best-effort — never let a sound break the UI.
  }
}
