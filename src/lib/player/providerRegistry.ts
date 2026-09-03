/**
 * Provider-aware registry for third-party embed players.
 *
 * Cross-origin iframes cannot be queried directly, so we use a layered strategy:
 * 1. Focus the iframe and dispatch keyboard events (universal fallback).
 * 2. Emit provider-specific postMessage commands when known.
 * 3. Parse provider-specific postMessage events to sync local UI state.
 */

export type EmbedProvider =
  | "vidsrc"
  | "vidlink"
  | "videasy"
  | "vidfast"
  | "yapgrid"
  | "generic";

export interface ProviderCommands {
  play?: unknown;
  pause?: unknown;
  toggle?: unknown;
  mute?: unknown;
  unmute?: unknown;
  volumeUp?: unknown;
  volumeDown?: unknown;
  seekForward?: unknown;
  seekBack?: unknown;
  seekTo?: (seconds: number) => unknown;
  setVolume?: (volume: number) => unknown; // 0..1
  setPlaybackRate?: (rate: number) => unknown;
}

export interface ProviderEvents {
  play?: string | string[];
  pause?: string | string[];
  time?: string | string[];
  ended?: string | string[];
  volume?: string | string[];
  muted?: string | string[];
}

export interface ProviderConfig {
  id: EmbedProvider;
  name: string;
  origins: string[];
  keyboardShortcuts: {
    playToggle: string;
    muteToggle: string;
    volumeUp: string;
    volumeDown: string;
    seekBack: string;
    seekForward: string;
  };
  commands: ProviderCommands;
  events: ProviderEvents;
  supportsPostMessage: boolean;
}

const VIDSRC_KEYBOARD = {
  playToggle: " ",
  muteToggle: "m",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  seekBack: "ArrowLeft",
  seekForward: "ArrowRight",
};

const VIDSRC_COMMANDS: ProviderCommands = {
  toggle: { event: "command", func: "togglePlay" },
  play: { event: "command", func: "playVideo" },
  pause: { event: "command", func: "pauseVideo" },
  mute: { event: "command", func: "mute" },
  unmute: { event: "command", func: "unMute" },
  volumeUp: { method: "volumeUp" },
  volumeDown: { method: "volumeDown" },
  seekForward: { event: "command", func: "seek", args: [10] },
  seekBack: { event: "command", func: "seek", args: [-10] },
  seekTo: (seconds: number) => ({ event: "command", func: "seek", args: [seconds] }),
  setVolume: (volume: number) => ({ event: "command", func: "setVolume", args: [volume] }),
  setPlaybackRate: (rate: number) => ({ event: "command", func: "setPlaybackRate", args: [rate] }),
};

// Documented: VidSrc CC emits { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
// with events "play" | "pause" | "time" (every 5s) | "complete".
const VIDSRC_EVENTS: ProviderEvents = {
  play: ["play", "playing"],
  pause: ["pause", "paused"],
  time: ["time", "timeupdate"],
  ended: ["complete", "ended"],
};

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "vidsrc",
    name: "VidSrc",
    // Canonical domain per current docs is `vidsrcme.ru`. `vidsrc.to` is
    // the per-domain mirror, and `vidsrc.me` is a legacy mirror that's
    // still reachable but no longer documented as primary.
    origins: [
      "vidsrcme.ru",
      "vidsrc.to",
      "vidsrc.me",
    ],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: VIDSRC_COMMANDS,
    events: VIDSRC_EVENTS,
    supportsPostMessage: true,
  },
  {
    id: "vidlink",
    name: "VidLink",
    origins: ["vidlink.pro", "vidlink.cc"],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: {
      toggle: { method: "togglePlay" },
      play: { method: "play" },
      pause: { method: "pause" },
      mute: { method: "mute" },
      unmute: { method: "unmute" },
      volumeUp: { method: "volumeUp" },
      volumeDown: { method: "volumeDown" },
      seekForward: { method: "seek", value: 10 },
      seekBack: { method: "seek", value: -10 },
      seekTo: (seconds: number) => ({ method: "seek", value: seconds }),
      setVolume: (volume: number) => ({ method: "setVolume", value: volume }),
      setPlaybackRate: (rate: number) => ({ method: "setPlaybackRate", value: rate }),
    },
    // Documented: VidLink emits { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
    // with events "play" | "pause" | "seeked" | "ended" | "timeupdate",
    // plus { type: "MEDIA_DATA" } watch-progress payloads.
    events: {
      play: ["play", "playing"],
      pause: ["pause", "paused"],
      time: ["timeupdate", "time", "seeked"],
      ended: ["ended", "complete"],
    },
    supportsPostMessage: true,
  },
  {
    id: "videasy",
    name: "Videasy",
    // Canonical domain per current docs is `player.videasy.to`. `videasy.to`
    // is the root host that the player domain redirects to / shares
    // infrastructure with. `player.videasy.net` is deprecated.
    origins: [
      "player.videasy.to",
      "videasy.to",
      "player.videasy.net",
    ],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: {
      toggle: { type: "toggle" },
      play: { type: "play" },
      pause: { type: "pause" },
      mute: { type: "mute" },
      unmute: { type: "unmute" },
      volumeUp: { type: "volumeUp" },
      volumeDown: { type: "volumeDown" },
      seekForward: { type: "seek", direction: "forward", amount: 10 },
      seekBack: { type: "seek", direction: "back", amount: 10 },
      seekTo: (seconds: number) => ({ type: "seek", time: Math.max(0, seconds) }),
      setVolume: (volume: number) => ({ type: "volume", value: volume }),
    },
    // Videasy emits watch-progress payloads as JSON strings:
    // { id, type, progress (percent), timestamp (s), duration (s) }
    events: {
      play: ["play"],
      pause: ["pause"],
      time: ["timeupdate", "time"],
      ended: ["ended", "complete"],
    },
    supportsPostMessage: true,
  },
  {
    id: "vidfast",
    name: "VidFast",
    origins: ["vidfast.pro"],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: {
      toggle: { method: "togglePlay" },
      play: { method: "play" },
      pause: { method: "pause" },
      mute: { method: "mute" },
      unmute: { method: "unmute" },
      volumeUp: { method: "volumeUp" },
      volumeDown: { method: "volumeDown" },
      seekForward: { method: "seek", value: 10 },
      seekBack: { method: "seek", value: -10 },
      seekTo: (seconds: number) => ({ method: "seek", value: seconds }),
      setVolume: (volume: number) => ({ method: "setVolume", value: volume }),
      setPlaybackRate: (rate: number) => ({ method: "setPlaybackRate", value: rate }),
    },
    // VidFast emits { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
    // with events "play" | "pause" | "seeked" | "ended" | "timeupdate".
    events: {
      play: ["play", "playing"],
      pause: ["pause", "paused"],
      time: ["timeupdate", "time", "seeked"],
      ended: ["ended", "complete"],
    },
    supportsPostMessage: true,
  },
  {
    id: "generic",
    name: "Generic",
    origins: [],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: {},
    events: {},
    supportsPostMessage: false,
  },
  {
    id: "yapgrid",
    name: "YapGrid",
    origins: ["yapgrid.com", "www.yapgrid.com"],
    keyboardShortcuts: VIDSRC_KEYBOARD,
    commands: {},
    events: {},
    supportsPostMessage: false,
  },
];

export function detectProvider(src: string): ProviderConfig {
  try {
    const resolved = resolveEmbedSrc(src);
    const url = new URL(resolved);
    const host = url.hostname.toLowerCase();
    const matched = PROVIDERS.find(
      (p) => p.id !== "generic" && p.origins.some((o) => host === o || host.endsWith(`.${o}`))
    );
    return matched || PROVIDERS.find((p) => p.id === "generic")!;
  } catch {
    return PROVIDERS.find((p) => p.id === "generic")!;
  }
}

/** Extract the real provider URL when loaded through /api/embed proxy. */
export function resolveEmbedSrc(iframeSrc: string): string {
  try {
    const url = new URL(iframeSrc, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const embedded = url.searchParams.get("src");
    if (embedded) return decodeURIComponent(embedded);
  } catch {
    // ignore
  }
  return iframeSrc;
}

export function isKnownProvider(src: string): boolean {
  return detectProvider(src).id !== "generic";
}
