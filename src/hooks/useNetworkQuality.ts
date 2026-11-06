"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initWebVitals } from "@/lib/analytics";

export type NetworkQuality = "high" | "medium" | "low";

// Initialize web vitals on first mount
let webVitalsInitialized = false;

if (typeof window !== "undefined" && !webVitalsInitialized) {
  webVitalsInitialized = true;
  initWebVitals();
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}

export function classifyNetwork(conn: NetworkInformationLike | null): NetworkQuality {
  if (!conn) return "high";
  if (conn.saveData) return "low";
  const et = (conn.effectiveType || "").toLowerCase();
  if (et === "slow-2g" || et === "2g") return "low";
  if (et === "3g") return "medium";
  const dl = typeof conn.downlink === "number" ? conn.downlink : 10;
  if (dl < 1.5) return "low";
  if (dl < 5) return "medium";
  return "high";
}

/**
 * Configuration for bandwidth probing
 */
export interface BandwidthProbeConfig {
  /** URL to fetch for bandwidth measurement (small, cacheable resource) */
  probeUrl?: string;
  /** Size of the probe resource in bytes (for calculating Mbps) */
  probeSizeBytes?: number;
  /** Minimum interval between probes in ms */
  minProbeIntervalMs?: number;
  /** Number of samples to average for stability */
  sampleCount?: number;
  /** Threshold in Mbps for quality tiers */
  thresholds?: {
    highToMedium: number;  // Mbps below which we downgrade from high to medium
    mediumToLow: number;   // Mbps below which we downgrade from medium to low
  };
}

const DEFAULT_CONFIG: Required<BandwidthProbeConfig> = {
  probeUrl: "/favicon.ico", // Small, always available, cacheable
  probeSizeBytes: 1024, // ~1KB estimate
  minProbeIntervalMs: 10000, // 10 seconds between probes
  sampleCount: 3,
  thresholds: {
    highToMedium: 5,  // < 5 Mbps -> medium
    mediumToLow: 1.5, // < 1.5 Mbps -> low
  },
};

/**
 * Measures bandwidth by timing a fetch request
 */
async function measureBandwidth(config: Required<BandwidthProbeConfig>): Promise<number | null> {
  const start = performance.now();
  try {
    const response = await fetch(config.probeUrl, {
      method: "HEAD",
      cache: "no-cache",
      credentials: "omit",
    });
    if (!response.ok) return null;
    const end = performance.now();
    const durationSec = (end - start) / 1000;
    if (durationSec <= 0) return null;
    // Calculate Mbps: (bytes * 8) / (duration * 1_000_000)
    const mbps = (config.probeSizeBytes * 8) / (durationSec * 1_000_000);
    return mbps;
  } catch {
    return null;
  }
}

/**
 * useNetworkQuality — reports the user's connection quality tier.
 *
 * Uses the Network Information API where available (Chrome/Edge/Android).
 * Adds active bandwidth probing for more accurate detection.
 * Falls back to "high" on unsupported browsers (Safari/Firefox) so we never
 * downgrade quality for users whose connection we cannot measure.
 */
export function useNetworkQuality(config?: BandwidthProbeConfig): NetworkQuality {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [quality, setQuality] = useState<NetworkQuality>(() => {
    if (typeof navigator === "undefined") return "high";
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection ?? null;
    return classifyNetwork(conn);
  });

  // Refs for bandwidth probing
  const probeSamplesRef = useRef<number[]>([]);
  const lastProbeTimeRef = useRef<number>(0);
  const isProbingRef = useRef(false);
  const qualityChangeCallbacksRef = useRef<Set<(q: NetworkQuality) => void>>(new Set());

  const runProbe = useCallback(async () => {
    if (isProbingRef.current) return;
    const now = Date.now();
    if (now - lastProbeTimeRef.current < mergedConfig.minProbeIntervalMs) return;

    isProbingRef.current = true;
    lastProbeTimeRef.current = now;

    const mbps = await measureBandwidth(mergedConfig);
    if (mbps !== null) {
      probeSamplesRef.current.push(mbps);
      if (probeSamplesRef.current.length > mergedConfig.sampleCount) {
        probeSamplesRef.current.shift();
      }

      // Calculate average
      const avg = probeSamplesRef.current.reduce((a, b) => a + b, 0) / probeSamplesRef.current.length;

      // Determine quality from bandwidth
      let newQuality: NetworkQuality;
      if (avg < mergedConfig.thresholds.mediumToLow) {
        newQuality = "low";
      } else if (avg < mergedConfig.thresholds.highToMedium) {
        newQuality = "medium";
      } else {
        newQuality = "high";
      }

      // Also consider Network Information API as a secondary signal
      const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection ?? null;
      const apiQuality = classifyNetwork(conn);

      // Use the worse of the two (more conservative)
      const finalQuality =
        (newQuality === "low" || apiQuality === "low") ? "low" :
        (newQuality === "medium" || apiQuality === "medium") ? "medium" :
        "high";

      setQuality(finalQuality);
      // Notify subscribers
      qualityChangeCallbacksRef.current.forEach(cb => cb(finalQuality));
    }

    isProbingRef.current = false;
  }, [mergedConfig]);

  // Subscribe to quality changes
  const onQualityChange = useCallback((callback: (q: NetworkQuality) => void) => {
    qualityChangeCallbacksRef.current.add(callback);
    return () => qualityChangeCallbacksRef.current.delete(callback);
  }, []);

  // Trigger an immediate probe
  const triggerProbe = useCallback(() => {
    lastProbeTimeRef.current = 0; // Reset to allow immediate probe
    runProbe();
  }, [runProbe]);

  // Network Information API listener (existing behavior)
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    if (!conn?.addEventListener) return;
    const update = () => setQuality(classifyNetwork(conn));
    conn.addEventListener("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  // Periodic bandwidth probing
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial probe
    runProbe();

    // Set up interval for periodic probing
    const interval = setInterval(runProbe, mergedConfig.minProbeIntervalMs);
    return () => clearInterval(interval);
  }, [runProbe, mergedConfig.minProbeIntervalMs]);

  return quality;
}

export default useNetworkQuality;