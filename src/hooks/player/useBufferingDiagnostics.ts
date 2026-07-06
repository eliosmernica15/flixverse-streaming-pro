import { useState, useEffect, useRef } from "react";

export interface BufferingDiagnostics {
  /** Network type from Network Information API */
  networkType: string;
  /** Estimated bandwidth in Mbps */
  bandwidth: number;
  /** Whether page is currently visible */
  isVisible: boolean;
  /** Whether device is on battery */
  isBatterySaving: boolean;
  /** rAF frame drops detected */
  frameDrops: number;
  /** Overall health score: good | fair | poor */
  health: "good" | "fair" | "poor";
}

const initialState: BufferingDiagnostics = {
  networkType: "unknown",
  bandwidth: 0,
  isVisible: true,
  isBatterySaving: false,
  frameDrops: 0,
  health: "good",
};

/**
 * Heuristic buffering diagnostics using Network Information API,
 * Page Visibility API, Battery API, and rAF frame drop detection.
 */
export function useBufferingDiagnostics(): BufferingDiagnostics {
  const [state, setState] = useState<BufferingDiagnostics>(initialState);
  const frameDropCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    // Network Information API
    const nav = navigator as any;
    const connection = nav.connection as any;

    const updateNetwork = () => {
      if (connection) {
        setState((prev) => ({
          ...prev,
          networkType: connection.effectiveType || "unknown",
          bandwidth: connection.downlink || 0,
        }));
      }
    };

    if (connection) {
      updateNetwork();
      connection.addEventListener("change", updateNetwork);
    }

    // Page Visibility API
    const handleVisibility = () => {
      setState((prev) => ({ ...prev, isVisible: !document.hidden }));
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Battery API
    const checkBattery = async () => {
      try {
        const navAny = navigator as any;
        const battery = await navAny.getBattery?.() as any;
        if (battery) {
          setState((prev) => ({ ...prev, isBatterySaving: battery.savingPower }));
          battery.addEventListener("chargingchange", () => {
            setState((prev) => ({ ...prev, isBatterySaving: battery.savingPower }));
          });
        }
      } catch {
        // Battery API not available
      }
    };
    void checkBattery();

    // rAF frame drop detection
    let animationId: number;
    const detectFrameDrop = (timestamp: number) => {
      if (lastFrameTimeRef.current > 0) {
        const delta = timestamp - lastFrameTimeRef.current;
        // Frames longer than 32ms (~30fps threshold) count as a drop
        if (delta > 32) {
          frameDropCountRef.current++;
          setState((prev) => ({
            ...prev,
            frameDrops: frameDropCountRef.current,
          }));
        }
      }
      lastFrameTimeRef.current = timestamp;
      animationId = requestAnimationFrame(detectFrameDrop);
    };
    animationId = requestAnimationFrame(detectFrameDrop);

    // Compute health score periodically
    const healthInterval = setInterval(() => {
      setState((prev) => {
        const drops = frameDropCountRef.current;
        const net = prev.networkType;
        const visible = prev.isVisible;

        let score = 100;
        if (drops > 20) score -= 30;
        else if (drops > 10) score -= 15;
        if (net === "slow-2g" || net === "2g") score -= 30;
        else if (net === "3g") score -= 15;
        if (!visible) score -= 10;
        if (prev.isBatterySaving) score -= 5;

        const health = score >= 70 ? "good" : score >= 40 ? "fair" : "poor";
        return { ...prev, health };
      });
    }, 5000);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(healthInterval);
      if (connection) connection.removeEventListener("change", updateNetwork);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return state;
}
