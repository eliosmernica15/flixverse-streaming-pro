"use client";

import { useEffect, useState } from "react";

export type NetworkQuality = "high" | "medium" | "low";

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
 * useNetworkQuality — reports the user's connection quality tier.
 *
 * Uses the Network Information API where available (Chrome/Edge/Android).
 * Falls back to "high" on unsupported browsers (Safari/Firefox) so we never
 * downgrade quality for users whose connection we cannot measure.
 */
export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>(() => {
    if (typeof navigator === "undefined") return "high";
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection ?? null;
    return classifyNetwork(conn);
  });

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    if (!conn?.addEventListener) return;
    const update = () => setQuality(classifyNetwork(conn));
    conn.addEventListener("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  return quality;
}

export default useNetworkQuality;