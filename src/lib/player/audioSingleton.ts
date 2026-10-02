/**
 * Global AudioContext singleton to prevent browser crashes from
 * concurrent AudioContext instances (>6 causes mute / OOM).
 */
let globalCtx: AudioContext | null = null;

export function getGlobalAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (globalCtx && globalCtx.state !== "closed") {
    if (globalCtx.state === "suspended") {
      void globalCtx.resume().catch(() => undefined);
    }
    return globalCtx;
  }
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    globalCtx = new Ctor();
  } catch {
    globalCtx = null;
  }
  return globalCtx;
}

export function closeGlobalAudioContext(): void {
  if (globalCtx && globalCtx.state !== "closed") {
    void globalCtx.close().catch(() => undefined);
  }
  globalCtx = null;
}
