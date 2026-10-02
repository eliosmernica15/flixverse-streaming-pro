"use client";

import { useEffect, useRef } from "react";

export function ChunkReloadBoundary() {
  const lastHashRef = useRef<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const recentChunkError = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flixverse_chunk_error_time") : null;
      if (recentChunkError && (Date.now() - parseInt(recentChunkError, 10)) < 30000) {
        return;
      }

      const current = window.__NEXT_DATA__ ? JSON.stringify(window.__NEXT_DATA__) : document.currentScript?.getAttribute("data-hash") ?? null;
      const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flixverse_last_deploy_hash") : null;
      if (current && current !== stored && stored) {
        const activeEl = document.activeElement as HTMLElement | null;
        const active = activeEl && ((activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") || activeEl.getAttribute("contenteditable") === "true");
        if (!active && document.visibilityState === "visible" && !document.hidden) {
          sessionStorage.setItem("flixverse_last_deploy_hash", current);
          if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
          reloadTimerRef.current = setTimeout(() => window.location.reload(), 500);
        }
      }
      if (current) {
        lastHashRef.current = current;
        sessionStorage.setItem("flixverse_last_deploy_hash", current);
      }
    } catch {
      // Ignore storage/access errors in private windows
    }
  }, []);

  useEffect(() => {
    const onChunkError = () => {
      try {
        sessionStorage.setItem("flixverse_chunk_error_time", String(Date.now()));
      } catch {
        // ignore
      }
    };
    window.addEventListener("error", (e) => {
      const msg = (e as ErrorEvent).message || "";
      if (msg.includes("ChunkLoadError") || msg.includes("chunk") || msg.includes("Failed to load resource")) {
        onChunkError();
      }
    }, true);
    return () => {
      window.removeEventListener("error", () => {} as any, true);
    };
  }, []);

  return null;
}
