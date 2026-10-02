/**
 * Two-way bridge for embedded video players.
 *
 * Inbound: parses documented provider postMessage events (VidSrc CC and
 * VidLink both emit `{ type: "PLAYER_EVENT", data: { event, currentTime,
 * duration } }`, VidLink additionally emits `MEDIA_DATA` watch-progress
 * payloads) and keeps the local UI state in sync — play state, time,
 * duration, volume.
 *
 * Outbound: dispatches commands through the provider-aware control layer
 * with optimistic local updates so the UI always responds instantly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendEmbedAction,
  sendEmbedVolume,
  sendEmbedSeek,
  sendEmbedVolumeStep,
  sendEmbedPlaybackRate,
  EmbedAction,
} from "@/lib/player/embedControls";
import { detectProvider, resolveEmbedSrc, ProviderConfig } from "@/lib/player/providerRegistry";

export type PlayerState = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0..1
  currentTime: number;
  duration: number;
  isReady: boolean;
  provider: ProviderConfig["id"];
  providerName: string;
  /** True once real playback events have been received from the embed. */
  isLiveSynced: boolean;
  playbackRate: number;
};

interface UseEmbedBridgeProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  totalDuration: number;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
}

function parseMessageData(event: MessageEvent): unknown {
  if (typeof event.data === "string") {
    try {
      return JSON.parse(event.data);
    } catch {
      return event.data;
    }
  }
  return event.data;
}

function matchesEvent(
  data: Record<string, unknown>,
  eventNames: string | string[] | undefined
): boolean {
  if (!eventNames) return false;
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  const eventType =
    (typeof data.event === "string" && data.event) ||
    (typeof data.type === "string" && data.type) ||
    (typeof data.method === "string" && data.method) ||
    (typeof data.action === "string" && data.action) ||
    "";
  return names.includes(eventType);
}

function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

function hostMatchesProvider(host: string, provider: ProviderConfig): boolean {
  return provider.origins.some((o) => host === o || host.endsWith(`.${o}`));
}

/**
 * Extract `{ watched, duration }` from a VidLink-style MEDIA_DATA payload.
 * Shape: `{ [id]: { progress: { watched, duration }, ... }, ... }` or a
 * flat `{ progress: { watched, duration } }`.
 */
function extractMediaProgress(
  data: Record<string, unknown>
): { watched: number; duration: number } | null {
  const tryProgress = (obj: Record<string, unknown>) => {
    const progress = obj.progress;
    if (progress && typeof progress === "object") {
      const p = progress as Record<string, unknown>;
      const watched = extractNumber(p.watched);
      const duration = extractNumber(p.duration);
      if (watched !== undefined && duration !== undefined) {
        return { watched, duration };
      }
    }
    return null;
  };

  const direct = tryProgress(data);
  if (direct) return direct;

  let latest: { watched: number; duration: number; ts: number } | null = null;
  for (const value of Object.values(data)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const found = tryProgress(entry);
    if (found) {
      const ts = extractNumber(entry.last_updated) ?? 0;
      if (!latest || ts >= latest.ts) latest = { ...found, ts };
    }
  }
  return latest ? { watched: latest.watched, duration: latest.duration } : null;
}

export function useEmbedBridge({
  iframeRef,
  enabled,
  totalDuration,
  onTimeUpdate,
  onPlayStateChange,
  onDurationChange,
  onEnded,
}: UseEmbedBridgeProps) {
  const [state, setState] = useState<PlayerState>({
    isPlaying: true,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: totalDuration,
    isReady: false,
    provider: "generic",
    providerName: "Generic",
    isLiveSynced: false,
    playbackRate: 1,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const providerRef = useRef<ProviderConfig | null>(null);
  const callbacksRef = useRef({ onTimeUpdate, onPlayStateChange, onDurationChange, onEnded });
  callbacksRef.current = { onTimeUpdate, onPlayStateChange, onDurationChange, onEnded };

  // Detect provider when iframe src changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const provider = detectProvider(iframe.src || "");
    providerRef.current = provider;
    setState((prev) => ({
      ...prev,
      provider: provider.id,
      providerName: provider.name,
      isLiveSynced: false,
    }));
  }, [iframeRef]);

  // Listen for provider events
  useEffect(() => {
    if (!enabled) return;

    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const providerSrc = resolveEmbedSrc(iframe.src || "");
      const provider = detectProvider(providerSrc);
      providerRef.current = provider;
      if (provider.id !== stateRef.current.provider) {
        setState((prev) => ({
          ...prev,
          provider: provider.id,
          providerName: provider.name,
          isLiveSynced: false,
        }));
      }
      if (provider.id === "generic") return;

      // Security: only trust messages coming from the embed itself — either
      // directly from the iframe window, or from an origin that belongs to
      // the detected provider (embeds often relay events from nested frames).
      let originHost = "";
      try {
        originHost = new URL(event.origin).hostname.toLowerCase();
      } catch {
        return;
      }
      const fromIframeWindow = event.source === iframe.contentWindow;
      const fromProviderOrigin = hostMatchesProvider(originHost, provider);
      const fromProxyWrapper =
        typeof window !== "undefined" &&
        iframe.src.includes("/api/embed") &&
        event.origin === window.location.origin;
      if (!fromIframeWindow && !fromProviderOrigin && !fromProxyWrapper) return;

      const data = parseMessageData(event);

      // Normalize the payload. Documented wrapper shapes:
      //   { type: "PLAYER_EVENT", data: { event, currentTime, duration } }
      //   { type: "MEDIA_DATA", data: { [id]: { progress: { watched, duration } } } }
      // Plus string events and flat objects for undocumented providers.
      let payload: Record<string, unknown>;
      if (typeof data === "string") {
        payload = { event: data };
      } else if (data && typeof data === "object") {
        const dataObj = data as Record<string, unknown>;
        if (dataObj.type === "MEDIA_DATA" && dataObj.data && typeof dataObj.data === "object") {
          const progress = extractMediaProgress(dataObj.data as Record<string, unknown>);
          if (progress) {
            const prev = stateRef.current;
            const next: PlayerState = {
              ...prev,
              currentTime: progress.watched,
              duration: progress.duration > 0 ? progress.duration : prev.duration,
              isLiveSynced: true,
            };
            setState(next);
            if (progress.duration > 0 && progress.duration !== prev.duration) {
              callbacksRef.current.onDurationChange?.(progress.duration);
            }
            if (progress.watched !== prev.currentTime) {
              callbacksRef.current.onTimeUpdate?.(progress.watched);
            }
          }
          return;
        }
        // Videasy-style watch progress: { id, type: "movie"|"tv", progress (%),
        // timestamp (s), duration (s) } — sent as a JSON string.
        const videasyTime = extractNumber(dataObj.timestamp);
        const videasyDuration = extractNumber(dataObj.duration);
        if (
          videasyTime !== undefined &&
          videasyDuration !== undefined &&
          videasyDuration > 0 &&
          dataObj.event === undefined &&
          dataObj.method === undefined &&
          dataObj.action === undefined
        ) {
          const prev = stateRef.current;
          const next: PlayerState = {
            ...prev,
            currentTime: videasyTime,
            duration: videasyDuration,
            isLiveSynced: true,
          };
          setState(next);
          if (videasyDuration !== prev.duration) {
            callbacksRef.current.onDurationChange?.(videasyDuration);
          }
          if (videasyTime !== prev.currentTime) {
            callbacksRef.current.onTimeUpdate?.(videasyTime);
          }
          return;
        }
        payload =
          dataObj.type === "PLAYER_EVENT" && typeof dataObj.data === "object" && dataObj.data !== null
            ? (dataObj.data as Record<string, unknown>)
            : dataObj;
      } else {
        return;
      }

      const prev = stateRef.current;
      const next = { ...prev };
      let changed = false;
      let recognized = false;

      if (matchesEvent(payload, provider.events.play)) {
        next.isPlaying = true;
        changed = true;
        recognized = true;
      } else if (matchesEvent(payload, provider.events.pause)) {
        next.isPlaying = false;
        changed = true;
        recognized = true;
      }

      if (matchesEvent(payload, provider.events.ended)) {
        next.isPlaying = false;
        changed = true;
        recognized = true;
        callbacksRef.current.onEnded?.();
      }

      // Providers include currentTime/duration on every PLAYER_EVENT (play,
      // pause, time, seeked, ended) — extract them regardless of event name.
      const nestedData =
        typeof payload.data === "object" && payload.data
          ? (payload.data as Record<string, unknown>)
          : {};
      const isTimeEvent =
        matchesEvent(payload, provider.events.time) ||
        matchesEvent(payload, ["seeked", "seek"]);
      const t =
        extractNumber(payload.currentTime) ??
        extractNumber(payload.time) ??
        extractNumber(payload.current_time) ??
        extractNumber(payload.position) ??
        extractNumber(nestedData.currentTime) ??
        extractNumber(nestedData.time) ??
        extractNumber(nestedData.position);
      if (t !== undefined && (isTimeEvent || recognized)) {
        next.currentTime = t;
        changed = true;
        recognized = true;
      }

      const d =
        extractNumber(payload.duration) ??
        extractNumber(payload.totalDuration) ??
        extractNumber(payload.total) ??
        extractNumber(nestedData.duration) ??
        extractNumber(nestedData.totalDuration);
      if (d !== undefined && d > 0 && d !== prev.duration) {
        next.duration = d;
        changed = true;
        recognized = true;
      }

      if (matchesEvent(payload, provider.events.volume)) {
        const v = extractNumber(payload.volume) ?? extractNumber(nestedData.volume);
        if (v !== undefined) {
          next.volume = Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
          changed = true;
          recognized = true;
        }
      }

      if (matchesEvent(payload, provider.events.muted)) {
        let m = payload.muted;
        if (m === undefined) m = nestedData.muted;
        if (typeof m === "boolean") {
          next.isMuted = m;
          changed = true;
          recognized = true;
        }
      }

      if (!changed) return;
      if (recognized) next.isLiveSynced = true;

      setState(next);
      if (next.duration !== prev.duration && next.duration > 0) {
        callbacksRef.current.onDurationChange?.(next.duration);
      }
      if (next.currentTime !== prev.currentTime) {
        callbacksRef.current.onTimeUpdate?.(next.currentTime);
      }
      if (next.isPlaying !== prev.isPlaying) {
        callbacksRef.current.onPlayStateChange?.(next.isPlaying);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, iframeRef]);

  const sendAction = useCallback(
    (action: EmbedAction, opts?: { seekSeconds?: number; volume?: number; steps?: number }) => {
      sendEmbedAction(iframeRef.current, action, opts);
      // Optimistically update local state for responsive UI
      if (action === "play") {
        setState((prev) => ({ ...prev, isPlaying: true }));
      } else if (action === "pause") {
        setState((prev) => ({ ...prev, isPlaying: false }));
      } else if (action === "toggle") {
        setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
      } else if (action === "mute") {
        setState((prev) => ({ ...prev, isMuted: true }));
      } else if (action === "unmute") {
        setState((prev) => ({ ...prev, isMuted: false }));
      } else if (action === "setVolume" && opts?.volume !== undefined) {
        setState((prev) => ({ ...prev, volume: opts.volume!, isMuted: opts.volume! === 0 }));
      }
    },
    [iframeRef]
  );

  const togglePlay = useCallback(() => {
    sendAction("toggle");
  }, [sendAction]);

  const play = useCallback(() => sendAction("play"), [sendAction]);
  const pause = useCallback(() => sendAction("pause"), [sendAction]);

  const toggleMute = useCallback(() => {
    sendAction(stateRef.current.isMuted ? "unmute" : "mute");
  }, [sendAction]);

  const setVolume = useCallback(
    (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      sendEmbedVolume(iframeRef.current, clamped);
      setState((prev) => ({ ...prev, volume: clamped, isMuted: clamped === 0 }));
    },
    [iframeRef]
  );

  const adjustVolume = useCallback(
    (delta: number) => {
      const direction = delta > 0 ? "up" : "down";
      const steps = Math.max(1, Math.round(Math.abs(delta) * 10));
      sendEmbedVolumeStep(iframeRef.current, direction, steps);
      setState((prev) => {
        const next = Math.max(0, Math.min(1, prev.volume + delta));
        return { ...prev, volume: next, isMuted: next === 0 };
      });
    },
    [iframeRef]
  );

  const seek = useCallback(
    (seconds: number) => {
      sendEmbedSeek(iframeRef.current, seconds);
    },
    [iframeRef]
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const direction = delta > 0 ? "forward" : "back";
      const steps = Math.max(1, Math.round(Math.abs(delta) / 5));
      sendAction(direction === "forward" ? "seekForward" : "seekBack", { steps });
      setState((prev) => {
        const max = prev.duration > 0 ? prev.duration : totalDuration;
        return {
          ...prev,
          currentTime: Math.max(0, Math.min(max, prev.currentTime + delta)),
        };
      });
      // Return the projected new time so callers (e.g. party host) can broadcast it
      const max = stateRef.current.duration > 0 ? stateRef.current.duration : totalDuration;
      return Math.max(0, Math.min(max, stateRef.current.currentTime + delta));
    },
    [sendAction, totalDuration]
  );

  const setReady = useCallback((ready: boolean) => {
    setState((prev) => ({ ...prev, isReady: ready, isLiveSynced: ready ? prev.isLiveSynced : false }));
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setState((prev) => (prev.isPlaying === playing ? prev : { ...prev, isPlaying: playing }));
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const clamped = Math.max(0.25, Math.min(2, rate));
      sendEmbedPlaybackRate(iframeRef.current, clamped);
      setState((prev) => ({ ...prev, playbackRate: clamped }));
      try {
        localStorage.setItem("flixverse-playback-rate", String(clamped));
      } catch {
        // ignore
      }
    },
    [iframeRef]
  );

  // Restore persisted playback rate on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("flixverse-playback-rate");
      if (stored) {
        const rate = parseFloat(stored);
        if (!isNaN(rate) && rate >= 0.25 && rate <= 2) {
          setState((prev) => ({ ...prev, playbackRate: rate }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    ...state,
    sendAction,
    togglePlay,
    play,
    pause,
    toggleMute,
    setVolume,
    adjustVolume,
    seek,
    seekRelative,
    setReady,
    setPlaying,
    setPlaybackRate,
  };
}
