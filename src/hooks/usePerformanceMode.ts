"use client";

import { useEffect, useState } from "react";

export const PERFORMANCE_MODE_KEY = "flixverse-performance-mode";
export const PERFORMANCE_MODE_EVENT = "flixverse-performance-mode-change";

export function usePerformanceMode(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(PERFORMANCE_MODE_KEY) === "true");
    } catch {
      setEnabled(false);
    }

    const update = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;
      if (typeof customEvent.detail?.enabled === "boolean") {
        setEnabled(customEvent.detail.enabled);
        return;
      }
      setEnabled(localStorage.getItem(PERFORMANCE_MODE_KEY) === "true");
    };

    window.addEventListener(PERFORMANCE_MODE_EVENT, update);
    return () => window.removeEventListener(PERFORMANCE_MODE_EVENT, update);
  }, []);

  return enabled;
}

export function setPerformanceMode(enabled: boolean): void {
  localStorage.setItem(PERFORMANCE_MODE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent(PERFORMANCE_MODE_EVENT, { detail: { enabled } })
  );
}
