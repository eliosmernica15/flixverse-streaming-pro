/**
 * Two-way bridge for embedded video players.
 *
 * Listens to provider postMessage events (where supported) to keep the local
 * UI state in sync, and provides command helpers that dispatch actions through
 * the provider-aware control layer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendEmbedAction,
  sendEmbedVolume,
  sendEmbedSeek,
  sendEmbedVolumeStep,
  EmbedAction,
} from "@/lib/player/embedControls";
import { detectProvider, ProviderConfig } from "@/lib/player/providerRegistry";

export type PlayerState = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0..1
  currentTime: number;
  duration: number;
  isReady: boolean;
  provider: ProviderConfig["id"];
  providerName: string;
};

interface UseEmbedBridgeProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  totalDuration: number;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
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
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

export function useEmbedBridge({
  iframeRef,
  enabled,
  totalDuration,
  onTimeUpdate,
  onPlayStateChange,
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
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const providerRef = useRef<ProviderConfig | null>(null);

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
    }));
  }, [iframeRef]);

  // Listen for provider events
  useEffect(() => {
    if (!enabled) return;

    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      // Provider detection can change when the iframe src changes; re-detect each message.
      const provider = detectProvider(iframe.src || "");
      providerRef.current = provider;
      if (provider.id !== stateRef.current.provider) {
        setState((prev) => ({ ...prev, provider: provider.id, providerName: provider.name }));
      }
      if (provider.id === "generic") return;

      // Security: only trust messages from the iframe's origin
      const iframeOrigin = new URL(iframe.src || window.location.href).origin;
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== iframeOrigin && event.origin !== "*") return;

      const data = parseMessageData(event) as Record<string, unknown>;
      if (!data || typeof data !== "object") return;

      // VidSrc.cc wraps events in { type: "PLAYER_EVENT", data: {...} }
      const payload =
        data.type === "PLAYER_EVENT" && typeof data.data === "object" && data.data !== null
          ? (data.data as Record<string, unknown>)
          : data;

      let nextState = { ...stateRef.current };
      let changed = false;

      if (matchesEvent(payload, provider.events.play)) {
        nextState.isPlaying = true;
        changed = true;
      } else if (matchesEvent(payload, provider.events.pause)) {
        nextState.isPlaying = false;
        changed = true;
      }

      if (matchesEvent(payload, provider.events.ended)) {
        nextState.isPlaying = false;
        changed = true;
      }

      if (matchesEvent(payload, provider.events.time)) {
        const t =
          extractNumber(payload.currentTime) ??
          extractNumber(payload.time) ??
          extractNumber(payload.current_time) ??
          extractNumber(payload.position);
        if (t !== undefined && isFinite(t)) {
          nextState.currentTime = Math.min(t, totalDuration || Infinity);
          changed = true;
        }
        const d =
          extractNumber(payload.duration) ??
          extractNumber(payload.totalDuration) ??
          extractNumber(payload.total);
        if (d !== undefined && isFinite(d) && d > 0) {
          nextState.duration = d;
          changed = true;
        }
      }

      if (matchesEvent(payload, provider.events.volume)) {
        const v = extractNumber(payload.volume);
        if (v !== undefined && isFinite(v)) {
          nextState.volume = Math.max(0, Math.min(1, v));
          changed = true;
        }
      }

      if (matchesEvent(payload, provider.events.muted)) {
        const m = payload.muted;
        if (typeof m === "boolean") {
          nextState.isMuted = m;
          changed = true;
        }
      }

      if (changed) {
        setState(nextState);
        if (onTimeUpdate && nextState.currentTime !== stateRef.current.currentTime) {
          onTimeUpdate(nextState.currentTime);
        }
        if (
          onPlayStateChange &&
          nextState.isPlaying !== stateRef.current.isPlaying
        ) {
          onPlayStateChange(nextState.isPlaying);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, iframeRef, totalDuration, onTimeUpdate, onPlayStateChange]);

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
    sendAction(state.isMuted ? "unmute" : "mute");
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, [sendAction, state.isMuted]);

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
      setState((prev) => ({
        ...prev,
        currentTime: Math.max(0, Math.min(totalDuration, prev.currentTime + delta)),
      }));
    },
    [sendAction, totalDuration]
  );

  const setReady = useCallback((ready: boolean) => {
    setState((prev) => ({ ...prev, isReady: ready }));
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setState((prev) => ({ ...prev, isPlaying: playing }));
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
  };
}
