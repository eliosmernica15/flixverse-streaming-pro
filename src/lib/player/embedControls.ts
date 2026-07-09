/**
 * Robust, provider-aware embed control layer.
 *
 * Commands are delivered through multiple transports:
 *  1. Focus the iframe (required for keyboard events to reach nested players).
 *  2. Dispatch KeyboardEvent sequences (keydown/keyup) on the iframe window.
 *  3. Dispatch KeyboardEvent sequences on the iframe element itself.
 *  4. Send provider-specific postMessage payloads.
 *  5. Send generic postMessage fallbacks.
 */

import { detectProvider, resolveEmbedSrc, ProviderConfig } from "./providerRegistry";

export type EmbedAction =
  | "play"
  | "pause"
  | "toggle"
  | "mute"
  | "unmute"
  | "volumeUp"
  | "volumeDown"
  | "seekForward"
  | "seekBack"
  | "seekTo"
  | "setVolume"
  | "setPlaybackRate";

interface SendOptions {
  /** Seek target in seconds (for seekTo). */
  seekSeconds?: number;
  /** Volume level 0..1 (for setVolume). */
  volume?: number;
  /** Playback rate multiplier (for setPlaybackRate). */
  rate?: number;
  /** Number of keyboard steps to emit for relative actions. */
  steps?: number;
}

const ACTION_KEY_MAP: Record<
  Exclude<EmbedAction, "seekTo" | "setVolume" | "setPlaybackRate">,
  keyof ProviderConfig["keyboardShortcuts"]
> = {
  play: "playToggle",
  pause: "playToggle",
  toggle: "playToggle",
  mute: "muteToggle",
  unmute: "muteToggle",
  volumeUp: "volumeUp",
  volumeDown: "volumeDown",
  seekForward: "seekForward",
  seekBack: "seekBack",
};

function focusIframe(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  try {
    iframe.focus({ preventScroll: true });
  } catch {
    // ignore
  }
}

function keyToCode(key: string): string {
  switch (key) {
    case " ":
      return "Space";
    case "ArrowUp":
      return "ArrowUp";
    case "ArrowDown":
      return "ArrowDown";
    case "ArrowLeft":
      return "ArrowLeft";
    case "ArrowRight":
      return "ArrowRight";
    case "m":
    case "M":
      return "KeyM";
    default:
      return key;
  }
}

function keyToKeyCode(key: string): number {
  switch (key) {
    case " ":
      return 32;
    case "ArrowUp":
      return 38;
    case "ArrowDown":
      return 40;
    case "ArrowLeft":
      return 37;
    case "ArrowRight":
      return 39;
    case "m":
    case "M":
      return 77;
    default:
      return 0;
  }
}

function dispatchKeyEvent(
  target: Window | HTMLIFrameElement,
  type: "keydown" | "keyup",
  key: string,
  code: string
) {
  try {
    const keyCode = keyToKeyCode(key);
    const event = new KeyboardEvent(type, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    });
    target.dispatchEvent(event);
  } catch {
    // Legacy fallback
    try {
      const legacy = document.createEvent("KeyboardEvent") as KeyboardEvent;
      (legacy as any).initKeyboardEvent(type, true, true, window, key, 0, false, false, false, false);
      target.dispatchEvent(legacy);
    } catch {
      // ignore
    }
  }
}

/** Press a key inside the iframe via both contentWindow and iframe element. */
function pressKey(iframe: HTMLIFrameElement | null, key: string, code: string, count = 1) {
  if (!iframe) return;
  focusIframe(iframe);
  const win = iframe.contentWindow;
  if (!win) return;

  for (let i = 0; i < count; i++) {
    dispatchKeyEvent(win, "keydown", key, code);
    dispatchKeyEvent(win, "keyup", key, code);
    // Some provider scripts listen on the iframe element rather than window
    dispatchKeyEvent(iframe, "keydown", key, code);
    dispatchKeyEvent(iframe, "keyup", key, code);
  }
}

function postMessage(iframe: HTMLIFrameElement | null, payloads: unknown[]) {
  const win = iframe?.contentWindow;
  if (!win) return;
  for (const payload of payloads) {
    if (payload === undefined) continue;
    try {
      const message = typeof payload === "string" ? payload : JSON.stringify(payload);
      win.postMessage(message, "*");
      // Also try object form (some providers expect objects, not strings)
      if (typeof payload !== "string") {
        win.postMessage(payload, "*");
      }
    } catch {
      // ignore cross-origin failures
    }
  }
}

function buildCommandPayloads(provider: ProviderConfig, action: EmbedAction, opts: SendOptions): unknown[] {
  const payloads: unknown[] = [];
  const cmds = provider.commands;

  const add = (payload: unknown | undefined) => {
    if (payload !== undefined) payloads.push(payload);
  };

  switch (action) {
    case "play":
      add(cmds.play);
      break;
    case "pause":
      add(cmds.pause);
      break;
    case "toggle":
      add(cmds.toggle);
      break;
    case "mute":
      add(cmds.mute);
      break;
    case "unmute":
      add(cmds.unmute);
      break;
    case "volumeUp":
      add(cmds.volumeUp);
      break;
    case "volumeDown":
      add(cmds.volumeDown);
      break;
    case "seekForward":
      add(cmds.seekForward);
      break;
    case "seekBack":
      add(cmds.seekBack);
      break;
    case "seekTo":
      if (opts.seekSeconds !== undefined && cmds.seekTo) {
        add(cmds.seekTo(opts.seekSeconds));
      }
      break;
    case "setVolume":
      if (opts.volume !== undefined && cmds.setVolume) {
        add(cmds.setVolume(opts.volume));
      }
      break;
    case "setPlaybackRate":
      if (opts.rate !== undefined && cmds.setPlaybackRate) {
        add(cmds.setPlaybackRate(opts.rate));
      }
      break;
  }

  // Generic fallbacks (exhaustive list for undocumented APIs like VidLink)
  switch (action) {
    case "play":
      payloads.push(
        "play",
        { method: "play" },
        { action: "play" },
        { type: "play" },
        { event: "command", func: "playVideo" },
        { type: "player", data: "play" },
        { type: "player", action: "play" },
        { type: "player", event: "play" },
        { type: "player", method: "play" },
        { type: "player", data: { type: "play" } },
        { type: "player", data: { action: "play" } },
        { type: "player", data: { event: "play" } },
        { type: "player", data: { method: "play" } },
        { event: "play" },
        { command: "play" }
      );
      break;
    case "pause":
      payloads.push(
        "pause",
        { method: "pause" },
        { action: "pause" },
        { type: "pause" },
        { event: "command", func: "pauseVideo" },
        { type: "player", data: "pause" },
        { type: "player", action: "pause" },
        { type: "player", event: "pause" },
        { type: "player", method: "pause" },
        { type: "player", data: { type: "pause" } },
        { type: "player", data: { action: "pause" } },
        { type: "player", data: { event: "pause" } },
        { type: "player", data: { method: "pause" } },
        { event: "pause" },
        { command: "pause" }
      );
      break;
    case "toggle":
      payloads.push(
        "toggle", "togglePlay",
        { method: "toggle" }, { method: "togglePlay" },
        { action: "toggle" }, { action: "togglePlay" },
        { type: "toggle" }, { type: "togglePlay" },
        { type: "player", data: "toggle" },
        { type: "player", data: "togglePlay" },
        { type: "player", action: "toggle" },
        { type: "player", data: { method: "toggle" } }
      );
      break;
    case "seekTo":
      if (opts.seekSeconds !== undefined) {
        payloads.push(
          { method: "seek", value: opts.seekSeconds },
          { action: "seek", value: opts.seekSeconds },
          { type: "seek", value: opts.seekSeconds },
          { type: "player", action: "seek", value: opts.seekSeconds },
          { type: "player", data: { method: "seek", value: opts.seekSeconds } },
          { type: "player", data: { action: "seek", value: opts.seekSeconds } },
          { event: "command", func: "seekTo", args: [opts.seekSeconds, true] },
          { method: "setCurrentTime", value: opts.seekSeconds },
          { type: "player", data: { method: "setCurrentTime", value: opts.seekSeconds } }
        );
      }
      break;
    case "mute":
      payloads.push(
        "mute",
        { method: "mute" }, { action: "mute" }, { type: "mute" },
        { method: "setMute", value: true },
        { type: "player", data: "mute" },
        { type: "player", data: { method: "mute" } }
      );
      break;
    case "unmute":
      payloads.push(
        "unmute",
        { method: "unmute" }, { action: "unmute" }, { type: "unmute" },
        { method: "setMute", value: false },
        { type: "player", data: "unmute" },
        { type: "player", data: { method: "unmute" } }
      );
      break;
    case "setVolume":
      if (opts.volume !== undefined) {
        payloads.push(
          { method: "setVolume", value: opts.volume },
          { action: "setVolume", value: opts.volume },
          { type: "volume", value: opts.volume },
          { event: "command", func: "setVolume", args: [opts.volume] },
          { type: "player", data: { method: "setVolume", value: opts.volume } }
        );
      }
      break;
    case "setPlaybackRate":
      if (opts.rate !== undefined) {
        payloads.push(
          { method: "setPlaybackRate", value: opts.rate },
          { action: "setPlaybackRate", value: opts.rate },
          { type: "playbackRate", value: opts.rate },
          { event: "command", func: "setPlaybackRate", args: [opts.rate] },
          { type: "player", data: { method: "setPlaybackRate", value: opts.rate } }
        );
      }
      break;
    case "volumeUp":
      payloads.push("volumeUp", { method: "volumeUp" }, { action: "volumeUp" }, { type: "player", data: "volumeUp" });
      break;
    case "volumeDown":
      payloads.push("volumeDown", { method: "volumeDown" }, { action: "volumeDown" }, { type: "player", data: "volumeDown" });
      break;
    case "seekForward":
      payloads.push(
        "seekForward",
        { method: "seek", value: 10 },
        { action: "seek", seconds: 10 },
        { type: "seek", direction: "forward", amount: 10 },
        { event: "command", func: "seek", args: [10] },
        { type: "player", data: "seekForward" }
      );
      break;
    case "seekBack":
      payloads.push(
        "seekBack",
        { method: "seek", value: -10 },
        { action: "seek", seconds: -10 },
        { type: "seek", direction: "back", amount: 10 },
        { event: "command", func: "seek", args: [-10] },
        { type: "player", data: "seekBack" }
      );
      break;
    case "seekTo":
      if (opts.seekSeconds !== undefined) {
        payloads.push(
          { method: "seek", value: opts.seekSeconds },
          { action: "seek", seconds: opts.seekSeconds },
          { type: "seek", value: opts.seekSeconds },
          { event: "command", func: "seek", args: [opts.seekSeconds] },
          { type: "player", data: { action: "seek", time: opts.seekSeconds } }
        );
      }
      break;
    case "setVolume":
      if (opts.volume !== undefined) {
        payloads.push(
          { method: "setVolume", value: opts.volume },
          { action: "volume", value: opts.volume },
          { type: "volume", value: opts.volume },
          { event: "command", func: "setVolume", args: [opts.volume] },
          { type: "player", data: { action: "volume", value: opts.volume } }
        );
      }
      break;
  }

  return payloads;
}

function getProviderFromIframe(iframe: HTMLIFrameElement | null): ProviderConfig {
  if (!iframe?.src) {
    return { id: "generic", name: "Generic", origins: [], keyboardShortcuts: { playToggle: " ", muteToggle: "m", volumeUp: "ArrowUp", volumeDown: "ArrowDown", seekBack: "ArrowLeft", seekForward: "ArrowRight" }, commands: {}, events: {}, supportsPostMessage: false };
  }
  return detectProvider(resolveEmbedSrc(iframe.src));
}

/** Send an action to the embedded provider player. */
export function sendEmbedAction(
  iframe: HTMLIFrameElement | null,
  action: EmbedAction,
  opts: SendOptions = {}
) {
  if (!iframe) return;
  const provider = getProviderFromIframe(iframe);

  // 1. Provider-specific + generic postMessage
  if (provider.supportsPostMessage || provider.id === "generic") {
    const payloads = buildCommandPayloads(provider, action, opts);
    if (payloads.length) postMessage(iframe, payloads);
  }

  // 2. Keyboard events as universal fallback / reinforcement
  if (action === "seekTo") {
    // No direct key for absolute seek; rely on postMessage. As a fallback,
    // send a forward/back key if we can infer direction from current time.
    return;
  }

  if (action === "setVolume") {
    // Volume keys are relative, so we ignore them here in favor of postMessage.
    return;
  }

  if (action === "setPlaybackRate") {
    return;
  }

  const keyName = ACTION_KEY_MAP[action as Exclude<EmbedAction, "seekTo" | "setVolume" | "setPlaybackRate">];
  if (!keyName) return;
  const key = provider.keyboardShortcuts[keyName];
  const code = keyToCode(key);
  const steps = Math.max(1, opts.steps ?? 1);
  pressKey(iframe, key, code, steps);
}

/** Send a discrete volume change using key events when exact control isn't available. */
export function sendEmbedVolumeStep(
  iframe: HTMLIFrameElement | null,
  direction: "up" | "down",
  steps = 1
) {
  sendEmbedAction(iframe, direction === "up" ? "volumeUp" : "volumeDown", { steps });
}

/** Send an absolute seek command. */
export function sendEmbedSeek(iframe: HTMLIFrameElement | null, seconds: number) {
  sendEmbedAction(iframe, "seekTo", { seekSeconds: seconds });
}

/** Send an absolute volume command (0..1). */
export function sendEmbedVolume(iframe: HTMLIFrameElement | null, volume: number) {
  const clamped = Math.max(0, Math.min(1, volume));
  sendEmbedAction(iframe, "setVolume", { volume: clamped });
}

/** Send an absolute playback rate command. */
export function sendEmbedPlaybackRate(iframe: HTMLIFrameElement | null, rate: number) {
  const clamped = Math.max(0.25, Math.min(2, rate));
  sendEmbedAction(iframe, "setPlaybackRate", { rate: clamped });
}

export function isPlayerShortcutKey(key: string) {
  return (
    key === " " ||
    key === "k" ||
    key === "K" ||
    key === "f" ||
    key === "F" ||
    key === "m" ||
    key === "M" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  );
}

export { detectProvider };
export type { EmbedProvider } from "./providerRegistry";
