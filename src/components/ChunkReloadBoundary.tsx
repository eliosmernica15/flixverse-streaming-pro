"use client";

import { useEffect, useRef } from "react";

export function ChunkReloadBoundary() {
  const lastHashRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const current = window.__NEXT_DATA__ ? JSON.stringify(window.__NEXT_DATA__) : document.currentScript?.getAttribute("data-hash") ?? null;
      const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flixverse_last_deploy_hash") : null;
      if (current && current !== stored && stored) {
        // Deployment changed — reload only if no active user interaction
        const active = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.contentEditable === "true");
        if (!active && document.visibilityState === "visible" && !document.hidden) {
          sessionStorage.setItem("flixverse_last_deploy_hash", current);
          window.location.reload();
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

  return null;
}
