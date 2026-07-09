/**
 * FlixVerse UI sound engine.
 *
 * Synthesizes subtle interface sounds with the Web Audio API — no audio
 * assets to download. Every sound is short (< 220ms), quiet, and tuned to
 * feel "glassy" to match the visual design language.
 *
 * Respects a persisted user preference (`flixverse-ui-sounds`) and never
 * throws: on unsupported browsers every call is a silent no-op.
 */

export type UiSoundName =
  | "tap" // generic button press
  | "toggle-on" // switch/setting enabled
  | "toggle-off" // switch/setting disabled
  | "open" // panel / modal / palette opens
  | "close" // panel / modal dismissed
  | "play" // playback started
  | "pause" // playback paused
  | "seek" // scrub / skip
  | "volume" // volume tick
  | "success" // positive confirmation
  | "error" // failure feedback
  | "hover"; // very subtle pointer-enter shimmer

const STORAGE_KEY = "flixverse-ui-sounds";
const MASTER_GAIN = 0.22;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled: boolean | null = null;
let lastPlayed: Record<string, number> = {};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getUiSoundsEnabled(): boolean {
  if (!isBrowser()) return false;
  if (enabled !== null) return enabled;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    enabled = stored === null ? true : stored === "true";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setUiSoundsEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent("flixverse-ui-sounds", { detail: { enabled: value } }));
  } catch {}
  if (value) playUiSound("toggle-on");
}

function getContext(): AudioContext | null {
  if (!isBrowser()) return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

interface Tone {
  freq: number;
  /** Frequency glide target (Hz). */
  to?: number;
  type?: OscillatorType;
  /** Start offset in seconds. */
  at?: number;
  duration: number;
  gain?: number;
}

function playTones(tones: Tone[]) {
  const context = getContext();
  if (!context || !master) return;
  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
  const now = context.currentTime;
  for (const tone of tones) {
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const start = now + (tone.at ?? 0);
      const end = start + tone.duration;
      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
      const peak = tone.gain ?? 1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(end + 0.01);
    } catch {}
  }
}

const SOUNDS: Record<UiSoundName, { tones: Tone[]; throttleMs: number }> = {
  tap: {
    tones: [{ freq: 2200, to: 1400, type: "sine", duration: 0.05, gain: 0.5 }],
    throttleMs: 40,
  },
  "toggle-on": {
    tones: [
      { freq: 660, type: "sine", duration: 0.07, gain: 0.6 },
      { freq: 990, type: "sine", at: 0.055, duration: 0.09, gain: 0.55 },
    ],
    throttleMs: 80,
  },
  "toggle-off": {
    tones: [
      { freq: 990, type: "sine", duration: 0.07, gain: 0.55 },
      { freq: 620, type: "sine", at: 0.055, duration: 0.09, gain: 0.5 },
    ],
    throttleMs: 80,
  },
  open: {
    tones: [
      { freq: 420, to: 840, type: "sine", duration: 0.14, gain: 0.5 },
      { freq: 1680, type: "sine", at: 0.06, duration: 0.1, gain: 0.2 },
    ],
    throttleMs: 120,
  },
  close: {
    tones: [{ freq: 840, to: 420, type: "sine", duration: 0.12, gain: 0.45 }],
    throttleMs: 120,
  },
  play: {
    tones: [
      { freq: 523, type: "sine", duration: 0.09, gain: 0.55 },
      { freq: 784, type: "sine", at: 0.07, duration: 0.12, gain: 0.5 },
    ],
    throttleMs: 150,
  },
  pause: {
    tones: [
      { freq: 784, type: "sine", duration: 0.09, gain: 0.5 },
      { freq: 523, type: "sine", at: 0.07, duration: 0.12, gain: 0.45 },
    ],
    throttleMs: 150,
  },
  seek: {
    tones: [{ freq: 1200, to: 2000, type: "sine", duration: 0.07, gain: 0.35 }],
    throttleMs: 90,
  },
  volume: {
    tones: [{ freq: 1600, type: "sine", duration: 0.04, gain: 0.3 }],
    throttleMs: 60,
  },
  success: {
    tones: [
      { freq: 523, type: "sine", duration: 0.08, gain: 0.5 },
      { freq: 659, type: "sine", at: 0.07, duration: 0.08, gain: 0.5 },
      { freq: 1047, type: "sine", at: 0.14, duration: 0.16, gain: 0.5 },
    ],
    throttleMs: 250,
  },
  error: {
    tones: [
      { freq: 330, type: "triangle", duration: 0.1, gain: 0.5 },
      { freq: 247, type: "triangle", at: 0.09, duration: 0.16, gain: 0.5 },
    ],
    throttleMs: 250,
  },
  hover: {
    tones: [{ freq: 2800, type: "sine", duration: 0.025, gain: 0.12 }],
    throttleMs: 120,
  },
};

/** Play a named UI sound. Safe to call anywhere (no-op on server / disabled). */
export function playUiSound(name: UiSoundName) {
  if (!isBrowser() || !getUiSoundsEnabled()) return;
  const sound = SOUNDS[name];
  if (!sound) return;
  const now = Date.now();
  if (lastPlayed[name] && now - lastPlayed[name] < sound.throttleMs) return;
  lastPlayed[name] = now;
  playTones(sound.tones);
}
