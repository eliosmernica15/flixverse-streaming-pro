/**
 * Haptic feedback for cinematic beats.
 *
 * Three delivery channels, each optional and independently gated:
 *
 *  1. **`navigator.vibrate`** — Android Chrome/Firefox phones and tablets.
 *     Silently absent on iOS Safari and desktop browsers.
 *  2. **Gamepad rumble** — `GamepadHapticActuator` (`"vibration"` effect)
 *     on Chrome/Edge with an Xbox or DualSense controller connected.
 *  3. **CSS pulse fallback** — a brief, subtle frame-squeeze the player
 *     applies itself (see `.cinema-pulse` in video-player.css). This is the
 *     only channel that works everywhere, so it is the baseline.
 *
 * All three share one throttle so a loud action sequence cannot turn the
 * phone into a rattle. Haptics are opt-in (`flixverse-haptics`), default off:
 * unexpected buzzing during a quiet drama is worse than no haptics at all.
 *
 * Capability detection is honest — `isHapticsSupported()` reports what this
 * device can actually do, and the settings UI uses it to avoid offering a
 * toggle that would do nothing.
 */

export type HapticStrength = "light" | "medium" | "heavy";

export interface HapticPattern {
  /** Milliseconds of vibration. */
  duration: number;
  /** Pause before the pulse, so transients feel tied to the hit. */
  delay?: number;
  strength: HapticStrength;
}

const STORAGE_KEY = "flixverse-haptics";
/** Minimum gap between two pulses. Action beats are bursty; 220 ms keeps
 *  them distinct without machine-gunning. */
const MIN_GAP_MS = 220;

const PATTERNS: Record<HapticStrength, HapticPattern> = {
  light: { duration: 12, strength: "light" },
  medium: { duration: 28, strength: "medium" },
  heavy: { duration: 55, delay: 0, strength: "heavy" },
};

let enabledCache: boolean | null = null;
let lastPulseAt = 0;

export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache !== null) return enabledCache;
  try {
    enabledCache = localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

export function setHapticsEnabled(value: boolean): void {
  enabledCache = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
  if (!value) cancelHaptics();
}

type VibrationParams = {
  duration: number;
  strongMagnitude: number;
  weakMagnitude: number;
};

interface HapticActuatorLike {
  playEffect?: (type: string, params: VibrationParams) => Promise<unknown>;
  reset?: () => Promise<unknown>;
}

/**
 * The DOM lib already declares `vibrationActuator` (with a narrow signature)
 * and does NOT declare the older `hapticActuators` array. Rather than fight
 * the built-in types, read both through a structural view at the call site.
 */
interface GamepadHapticsView {
  vibrationActuator?: HapticActuatorLike | null;
  hapticActuators?: HapticActuatorLike[] | null;
}

function padHaptics(pad: Gamepad): GamepadHapticsView {
  return pad as unknown as GamepadHapticsView;
}

function connectedGamepads(): Gamepad[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return [];
  }
  try {
    return navigator.getGamepads().filter((pad): pad is Gamepad => pad !== null);
  } catch {
    return [];
  }
}

/** What this device can actually do, for honest settings UI. */
export function getHapticsCapabilities(): {
  vibration: boolean;
  gamepad: boolean;
  fallbackPulse: true;
} {
  const vibration =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const gamepad = connectedGamepads().some((pad) => {
    const view = padHaptics(pad);
    return Boolean(view.vibrationActuator?.playEffect) || Boolean(view.hapticActuators?.length);
  });
  return { vibration, gamepad, fallbackPulse: true };
}

export function isHapticsSupported(): boolean {
  const caps = getHapticsCapabilities();
  return caps.vibration || caps.gamepad;
}

function pulseGamepads(strength: HapticStrength, duration: number): void {
  const magnitude =
    strength === "heavy" ? 0.9 : strength === "medium" ? 0.55 : 0.25;
  const weak = magnitude * 0.6;

  const params: VibrationParams = { duration, strongMagnitude: magnitude, weakMagnitude: weak };

  for (const pad of connectedGamepads()) {
    const view = padHaptics(pad);
    const actuator = view.vibrationActuator;
    if (actuator?.playEffect) {
      void actuator.playEffect("vibration", params).catch(() => undefined);
      continue;
    }
    const haptic = view.hapticActuators?.[0];
    if (haptic?.playEffect) {
      void haptic.playEffect("vibration", params).catch(() => undefined);
    }
  }
}

/** Broadcast name the player listens to for the visual frame-pulse fallback. */
export const CINEMA_PULSE_EVENT = "flixverse:cinema-pulse";

/**
 * Fire one haptic pulse. No-ops when disabled, throttled, or unsupported.
 *
 * Returns true when at least one physical channel fired. Regardless of the
 * hardware result, a `CINEMA_PULSE_EVENT` is dispatched so the player can
 * apply its own subtle frame pulse — the one channel that works on every
 * device, including desktop browsers with no vibration motor.
 */
export function fireHaptic(strength: HapticStrength = "medium"): boolean {
  if (typeof window === "undefined") return false;
  if (!isHapticsEnabled()) return false;

  const now = Date.now();
  if (now - lastPulseAt < MIN_GAP_MS) return false;
  lastPulseAt = now;

  const pattern = PATTERNS[strength];
  let fired = false;

  if (typeof navigator.vibrate === "function") {
    try {
      fired = navigator.vibrate(pattern.duration) || fired;
    } catch {
      // Some browsers throw on vibrate outside a user gesture.
    }
  }

  const pads = connectedGamepads();
  if (pads.length > 0) {
    pulseGamepads(strength, pattern.duration);
    fired = true;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(CINEMA_PULSE_EVENT, { detail: { strength, physical: fired } })
    );
  } catch {
    // CustomEvent unavailable (ancient engines) — nothing else to do.
  }

  return fired;
}

export function cancelHaptics(): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
  for (const pad of connectedGamepads()) {
    void pad.vibrationActuator?.reset?.().catch(() => undefined);
  }
}

/**
 * Map a normalised audio energy level (0–1) to a haptic strength.
 * Used by the audio-reactivity path: a bass drop at 0.9 gets `heavy`,
 * ordinary dialogue never triggers at all.
 */
export function strengthForEnergy(energy: number): HapticStrength | null {
  if (energy < 0.55) return null; // silence and speech do not buzz
  if (energy < 0.72) return "light";
  if (energy < 0.88) return "medium";
  return "heavy";
}
