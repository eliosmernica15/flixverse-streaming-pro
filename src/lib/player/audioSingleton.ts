/**
 * Shared AudioContext.
 *
 * Browsers cap the number of live AudioContext instances per document
 * (Chrome: 6). Creating one per UI sound, per mic analyser, or per remote
 * stream quickly exhausts that budget — after which `new AudioContext()`
 * throws, Web Audio goes silent, and some engines leak native audio
 * threads until the tab is killed. Every audio consumer in the app must go
 * through this module.
 *
 * The context is created lazily on first use and never closed while the
 * document lives: closing and recreating it resets hardware state and is a
 * common source of "audio stopped working" bugs. `suspendSharedAudio()`
 * releases the hardware while idle; the next `getGlobalAudioContext()`
 * resumes it.
 */

let globalCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let refCount = 0;

type AudioContextCtor = typeof AudioContext;

function resolveCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Returns the shared AudioContext, creating it on first use.
 * Returns null on the server or when Web Audio is unavailable.
 */
export function getGlobalAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (globalCtx && globalCtx.state !== "closed") {
    if (globalCtx.state === "suspended") {
      void globalCtx.resume().catch(() => undefined);
    }
    return globalCtx;
  }

  const Ctor = resolveCtor();
  if (!Ctor) return null;

  try {
    globalCtx = new Ctor();
    masterGain = globalCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(globalCtx.destination);
  } catch {
    globalCtx = null;
    masterGain = null;
  }
  return globalCtx;
}

/**
 * The single output node every app sound should route into. Using one
 * master gain lets mute-all / volume ducking act globally without
 * re-wiring individual graphs.
 */
export function getMasterGain(): GainNode | null {
  const ctx = getGlobalAudioContext();
  if (!ctx) return null;
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

/** Resume the context after a user gesture (required by autoplay policy). */
export function resumeGlobalAudioContext(): void {
  const ctx = globalCtx;
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
}

/**
 * Create an analyser fed by a MediaStream, on the shared context.
 * Callers own the source node and must `disconnect()` it when the stream
 * ends; the shared context itself stays alive.
 */
export function createStreamAnalyser(
  stream: MediaStream,
  fftSize = 512,
  smoothing = 0.65
): { ctx: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode } | null {
  const ctx = getGlobalAudioContext();
  if (!ctx) return null;
  try {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    source.connect(analyser);
    // NOTE: deliberately not connected to destination — analysers are
    // measurement-only here; audible playback for remote peers is handled
    // by <audio> elements, and feeding the graph twice would double the
    // remote voice.
    return { ctx, analyser, source };
  } catch {
    return null;
  }
}

/** Track a consumer that needs the context alive (used to defer suspension). */
export function retainAudioContext(): void {
  refCount += 1;
}

/**
 * Release a retain. When the last consumer leaves, the context is suspended
 * to free the audio hardware.
 *
 * The suspension is deferred by a short grace period rather than applied
 * immediately. Streams are recreated constantly in a party — every camera
 * toggle, every peer joining, every mute — and suspending/resuming the
 * context dozens of times a minute caused audible clicks and, on some
 * Android builds, permanently wedged the audio thread. A brief idle window
 * collapses a burst of churn into a single suspend.
 */
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

export function releaseAudioContext(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    suspendTimer = null;
    if (refCount === 0) suspendSharedAudio();
  }, 1500);
}

/** Suspend playback without destroying the context. Safe to call repeatedly. */
export function suspendSharedAudio(): void {
  if (globalCtx && globalCtx.state === "running") {
    void globalCtx.suspend().catch(() => undefined);
  }
}

/**
 * Fully close the shared context. Only for teardown paths where the app is
 * genuinely done with audio (e.g. leaving the player entirely). Most callers
 * want `suspendSharedAudio()` instead.
 */
export function closeGlobalAudioContext(): void {
  const ctx = globalCtx;
  globalCtx = null;
  masterGain = null;
  refCount = 0;
  if (ctx && ctx.state !== "closed") {
    void ctx.close().catch(() => undefined);
  }
}

export function getAudioConsumerCount(): number {
  return refCount;
}
