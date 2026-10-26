"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useScreenCaptureBloom — opt-in "true" ambilight via the Screen Capture API.
 *
 * Cross-origin provider iframes (VidSrc, Videasy, …) cannot be read pixel-by-
 * pixel, so the normal bloom falls back to a palette-driven simulation. This
 * hook instead asks the browser to capture the user's screen (or a window/tab)
 * and exposes the resulting `MediaStream` as a hidden `<video>` element. The
 * existing `ScreenBloomSampler` can then read real pixels from that element —
 * the room genuinely changes colour with whatever is on screen.
 *
 * Privacy: capture is 100 % local. No frame is ever uploaded, stored, or
 * transmitted. The browser shows its own permission picker every time and the
 * user can stop sharing from the browser chrome at any moment.
 *
 * `enabled` must be toggled by an explicit user gesture (the settings toggle)
 * because `getDisplayMedia` requires a user activation in most browsers.
 */

const STORAGE_KEY = "flixverse-screen-capture-bloom";

export function isScreenCaptureBloomEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setScreenCaptureBloomEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("toggle-screen-capture-bloom", { detail: { enabled: value } }));
}

export type ScreenCaptureStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unsupported"
  | "stopped";

export interface UseScreenCaptureBloomResult {
  /** Ref to attach to a hidden <video> element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: ScreenCaptureStatus;
  /** Start capture. Must be called from a user gesture. */
  start: () => Promise<void>;
  /** Stop capture and release the stream. */
  stop: () => void;
  /** Whether the Screen Capture API is available. */
  supported: boolean;
}

export function useScreenCaptureBloom(enabled: boolean): UseScreenCaptureBloomResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<ScreenCaptureStatus>("idle");

  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      try {
        video.srcObject = null;
      } catch {
        // ignore
      }
    }
    setStatus("stopped");
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 8 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => undefined);
      }
      // Auto-stop when the user ends sharing from the browser chrome.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stop();
      });
      setStatus("active");
    } catch {
      setStatus("denied");
    }
  }, [supported, stop]);

  // React to enabled flag: start on enable, stop on disable.
  useEffect(() => {
    if (enabled && status === "idle") {
      // Do not auto-start: getDisplayMedia needs a user gesture. The enabled
      // flag is flipped by the toggle, which is a gesture, so we start here.
      void start();
    } else if (!enabled && (status === "active" || status === "requesting")) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, status, start, stop, supported };
}

export default useScreenCaptureBloom;