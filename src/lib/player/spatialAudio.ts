/**
 * Spatial audio for party voice chat.
 *
 * Each remote participant's voice is positioned in 3D space according to where
 * their camera tile sits on screen, using an HRTF panner (so the sound has
 * real elevation/azimuth cues, not just left/right balance) plus a short
 * reverb tail for a "theatre row" feel.
 *
 * Design notes:
 *
 *  - Uses a single `AudioContext` (the app-wide singleton) and one
 *    `PannerNode` (HRTF) per peer, plus an optional shared `ConvolverNode`
 *    reverb send.
 *  - The `<audio>` element remains the playback path (so iOS keeps its media
 *    session and the element can be muted/unmuted by the browser's own
 *    autoplay heuristics), and the Web Audio chain is inserted with
 *    `createMediaElementSource` only once per element.
 *  - If the element was already tapped by another consumer, `createMediaElementSource`
 *    throws; we fall back to plain element playback rather than silence.
 *  - Positions are smoothed with `setTargetAtTime` so a layout change glides
 *    rather than jumps.
 *  - Reverb is a single shared convolver (lazy-built) so N peers do not
 *    each allocate their own impulse response.
 */

import { audioContext } from "./audioSingleton";

/**
 * An element can be bound to exactly ONE MediaElementAudioSourceNode for its
 * whole lifetime — a second `createMediaElementSource` throws, and the element
 * stays captured by the first node (so it no longer plays directly). React
 * StrictMode mounts → unmounts → remounts effects in development, which used
 * to leave the voice captured by a disconnected node: total silence. Caching
 * the node per element lets a re-attach reuse it.
 */
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function getElementSource(
  ctx: AudioContext,
  element: HTMLMediaElement
): MediaElementAudioSourceNode | null {
  const existing = elementSources.get(element);
  if (existing) return existing.context === ctx ? existing : null;
  const created = ctx.createMediaElementSource(element);
  elementSources.set(element, created);
  return created;
}

export interface SpatialVoiceNode {
  panner: PannerNode;
  source: MediaElementAudioSourceNode | null;
  element: HTMLAudioElement;
  /** 0 = far left, 0.5 = centre, 1 = far right. */
  pan: number;
  /** Reverb send gain (0 = dry). */
  reverbSend: GainNode | null;
  /** True once detach ran — guards the context refcount against double release. */
  released: boolean;
}

const SMOOTHING_SECONDS = 0.12;
const MAX_PAN = 0.62;

/** Distance model tuning — voices stay audible but attenuate with "depth". */
const REF_DISTANCE = 1;
const MAX_DISTANCE = 8;
const ROLLOFF = 0.6;

let sharedReverb: ConvolverNode | null = null;
let sharedReverbGain: GainNode | null = null;

function getReverb(ctx: AudioContext): { conv: ConvolverNode; gain: GainNode } | null {
  // Nodes are bound to the context that created them; a cached reverb from a
  // closed context would throw on connect, so rebuild it for the live one.
  if (sharedReverb && sharedReverbGain && sharedReverb.context === ctx) {
    return { conv: sharedReverb, gain: sharedReverbGain };
  }
  sharedReverb = null;
  sharedReverbGain = null;
  try {
    const conv = ctx.createConvolver();
    const gain = ctx.createGain();
    gain.gain.value = 0.22; // subtle theatre tail
    // Build a short synthetic impulse response (exponential decay noise).
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.9);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        // Exponential decay with a high-frequency roll-off toward the tail.
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (1 - t * 0.6);
      }
    }
    conv.buffer = buffer;
    conv.connect(gain);
    // Through the destination so app-wide mute / ducking also applies to the reverb tail.
    gain.connect(ctx.destination);
    sharedReverb = conv;
    sharedReverbGain = gain;
    return { conv, gain };
  } catch {
    return null;
  }
}

function clampPan(pan: number): number {
  if (!Number.isFinite(pan)) return 0;
  return Math.max(-MAX_PAN, Math.min(MAX_PAN, pan));
}

/**
 * Convert a normalised 0…1 pan into a 3D position. HRTF needs x/y/z, so we
 * place the voice on an arc in front of the listener: centre = straight ahead,
 * sides = ±MAX_PAN on X, slight depth (Z) so side voices feel "off to the side"
 * rather than inside the head.
 */
function panToPosition(pan: number): { x: number; y: number; z: number } {
  const p = clampPan(pan);
  return { x: p, y: 0, z: Math.abs(p) * 0.35 };
}

export function attachSpatialVoice(
  element: HTMLAudioElement,
  pan: number
): SpatialVoiceNode | null {
  const ctx = audioContext.getContext();
  if (!ctx) return null;

  try {
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = REF_DISTANCE;
    panner.maxDistance = MAX_DISTANCE;
    panner.rolloffFactor = ROLLOFF;
    const pos = panToPosition(pan);
    if (typeof panner.positionX?.setTargetAtTime === "function") {
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
    } else {
      panner.setPosition(pos.x, pos.y, pos.z);
    }

    const reverb = getReverb(ctx);
    const reverbSend = reverb ? ctx.createGain() : null;
    if (reverbSend) {
      reverbSend.gain.value = 0.18;
    }

    let source: MediaElementAudioSourceNode | null = null;
    try {
      source = getElementSource(ctx, element);
    } catch {
      source = null;
    }
    // Element could not be routed through Web Audio: it is still playing
    // directly, so plain centred playback continues.
    if (!source) return null;

    try {
      source.disconnect();
    } catch {
      // fresh node — nothing connected yet
    }

    try {
      source.connect(panner);
      panner.connect(ctx.destination);
    } catch {
      // The element is captured by `source` now, so it no longer plays on
      // its own. Never leave it silent: route it dry to the destination.
      try {
        panner.disconnect();
      } catch {
        // ignore
      }
      try {
        source.connect(ctx.destination);
      } catch {
        // ignore
      }
      return null;
    }

    if (reverb && reverbSend) {
      try {
        panner.connect(reverbSend);
        reverbSend.connect(reverb.conv);
      } catch {
        // Reverb is decorative — the dry spatial path already works.
      }
    }

    // Retain audio context reference
    audioContext.getContext(); // increments ref count
    return { panner, source, element, pan: clampPan(pan), reverbSend, released: false };
  } catch {
    return null;
  }
}

export function updateSpatialVoicePan(node: SpatialVoiceNode, pan: number): void {
  const next = clampPan(pan);
  if (Math.abs(next - node.pan) < 0.01) return;
  node.pan = next;
  const ctx = audioContext.getContext();
  if (!ctx) return;
  const pos = panToPosition(next);
  try {
    node.panner.positionX.setTargetAtTime(pos.x, ctx.currentTime, SMOOTHING_SECONDS);
    node.panner.positionY.setTargetAtTime(pos.y, ctx.currentTime, SMOOTHING_SECONDS);
    node.panner.positionZ.setTargetAtTime(pos.z, ctx.currentTime, SMOOTHING_SECONDS);
  } catch {
    try {
      node.panner.setPosition(pos.x, pos.y, pos.z);
    } catch {
      // ignore
    }
  }
}

export function detachSpatialVoice(node: SpatialVoiceNode | null): void {
  if (!node || node.released) return;
  node.released = true;
  // Release the audio context reference
  audioContext.closeContext();
  try {
    node.source?.disconnect();
  } catch {
    // ignore
  }
  try {
    node.panner.disconnect();
  } catch {
    // ignore
  }
  try {
    node.reverbSend?.disconnect();
  } catch {
    // ignore
  }
}

export function panForTile(index: number, total: number): number {
  if (total <= 1) return 0;
  const normalised = index / (total - 1); // 0…1
  const centered = normalised * 2 - 1; // -1…1
  const eased = Math.sign(centered) * Math.pow(Math.abs(centered), 0.85);
  return eased * MAX_PAN;
}

const spatialAudio = { attachSpatialVoice, updateSpatialVoicePan, detachSpatialVoice, panForTile, clampPan };
export default spatialAudio;