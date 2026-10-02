/**
 * Dynamic audio ducking using Web Audio API singleton.
 * When anyone in the party speaks (> -42 dB), smoothly attenuate
 * movie audio by 65 % over 150 ms. When speech stops (> 1.2 s silence),
 * ramp movie volume back to 100 %.
 */
import { getGlobalAudioContext } from "./audioSingleton";

const DUCK_TARGET = 0.35; // 65 % attenuation (1 - 0.65)
const SPEAK_THRESHOLD_DBS = -42;
const SILENCE_TIMEOUT_MS = 1200;
const RAMP_MS = 150;

export interface AudioDuckerState {
  isDucking: boolean;
  sourceNode?: MediaElementAudioSourceNode | null;
  gainNode?: GainNode | null;
  duckTimer?: ReturnType<typeof setTimeout> | null;
}

export function createAudioDucker(): AudioDuckerState {
  return { isDucking: false, sourceNode: null, gainNode: null, duckTimer: null };
}

export function setupMovieAudioDucking(
  audioElement: HTMLAudioElement | HTMLVideoElement | null,
  state: AudioDuckerState
) {
  const ctx = getGlobalAudioContext();
  if (!ctx || !audioElement) return;

  try {
    if (!state.sourceNode) {
      state.sourceNode = ctx.createMediaElementSource(audioElement);
      state.gainNode = ctx.createGain();
      state.gainNode.gain.value = 1; // full volume initially
      state.sourceNode.connect(state.gainNode);
      state.gainNode.connect(ctx.destination);
    }
  } catch {
    // Some browsers restrict createMediaElementSource on cross-origin
    // embeds; fail gracefully.
  }
}

export function applyDucking(
  isSpeaking: boolean,
  state: AudioDuckerState,
  nowMs: number = Date.now()
) {
  const gain = state.gainNode;
  if (!gain) return;

  if (isSpeaking) {
    if (state.duckTimer) {
      clearTimeout(state.duckTimer);
      state.duckTimer = null;
    }
    state.isDucking = true;
    // Smooth attenuate over 150 ms
    gain.gain.setTargetAtTime(DUCK_TARGET, Date.now() / 1000, RAMP_MS / 1000);
  } else if (state.isDucking) {
    // Start silence timer; only restore after sustained silence
    if (!state.duckTimer) {
      state.duckTimer = setTimeout(() => {
        state.isDucking = false;
        state.duckTimer = null;
        gain.gain.setTargetAtTime(1, Date.now() / 1000, RAMP_MS / 1000);
      }, SILENCE_TIMEOUT_MS);
    }
  }
}

export function teardownAudioDucking(state: AudioDuckerState) {
  if (state.duckTimer) {
    clearTimeout(state.duckTimer);
    state.duckTimer = null;
  }
  state.isDucking = false;
  try {
    if (state.gainNode) {
      state.gainNode.gain.setTargetAtTime(1, Date.now() / 1000, 0.05);
    }
  } catch {
    // ignore
  }
}
