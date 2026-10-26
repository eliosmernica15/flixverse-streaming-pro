/**
 * Dynamic audio ducking using the shared Web Audio context.
 *
 * When anyone in the party speaks (> -42 dB) the *party voice* bus is
 * boosted slightly and the app's own sound effects bus is attenuated, so
 * speech stays intelligible. Movie audio itself lives inside a
 * cross-origin provider iframe and cannot be routed through Web Audio —
 * that case is handled in volume space by `useVolumeDucking`.
 */
import { getGlobalAudioContext, getMasterGain } from "./audioSingleton";

const DUCK_TARGET = 0.35; // 65 % attenuation of app sounds
const RAMP_MS = 150;
const SILENCE_TIMEOUT_MS = 1200;

export interface AudioDuckerState {
  isDucking: boolean;
  gainNode?: GainNode | null;
  duckTimer?: ReturnType<typeof setTimeout> | null;
}

export function createAudioDucker(): AudioDuckerState {
  return { isDucking: false, gainNode: null, duckTimer: null };
}

/**
 * Attach a gain stage to the shared master bus. Idempotent — repeat calls
 * reuse the existing node instead of stacking gain stages.
 */
export function setupMovieAudioDucking(state: AudioDuckerState): void {
  if (state.gainNode) return;
  const master = getMasterGain();
  if (!master) return;
  try {
    const gain = master.context.createGain();
    gain.gain.value = 1;
    master.connect(gain);
    gain.connect(master.context.destination);
    state.gainNode = gain;
    // Route app sounds through the ducking stage instead of straight to
    // the destination, so ducking actually affects them.
    master.disconnect();
    master.connect(gain);
  } catch {
    state.gainNode = null;
  }
}

/** Ramp the ducking stage toward the target for the given speaking state. */
export function applyDucking(isSpeaking: boolean, state: AudioDuckerState): void {
  const gain = state.gainNode;
  if (!gain) return;

  const ctx = getGlobalAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const ramp = RAMP_MS / 1000;

  if (isSpeaking) {
    if (state.duckTimer) {
      clearTimeout(state.duckTimer);
      state.duckTimer = null;
    }
    state.isDucking = true;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(DUCK_TARGET, now, ramp);
  } else if (state.isDucking) {
    // Hold the duck through short pauses so normal speech rhythm does not
    // pump the volume up and down between words.
    if (!state.duckTimer) {
      state.duckTimer = setTimeout(() => {
        state.isDucking = false;
        state.duckTimer = null;
        const current = getGlobalAudioContext();
        if (!current || !state.gainNode) return;
        state.gainNode.gain.cancelScheduledValues(current.currentTime);
        state.gainNode.gain.setTargetAtTime(1, current.currentTime, ramp);
      }, SILENCE_TIMEOUT_MS);
    }
  }
}

export function teardownAudioDucking(state: AudioDuckerState): void {
  if (state.duckTimer) {
    clearTimeout(state.duckTimer);
    state.duckTimer = null;
  }
  state.isDucking = false;
  const gain = state.gainNode;
  state.gainNode = null;
  if (!gain) return;
  try {
    const ctx = getGlobalAudioContext();
    if (ctx) gain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    gain.disconnect();
  } catch {
    // ignore
  }
}
