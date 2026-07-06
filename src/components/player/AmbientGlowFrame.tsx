"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useDominantColors } from "@/hooks/player/useDominantColors";
import { rgbToCss } from "@/lib/player/extractDominantColors";

interface AmbientGlowFrameProps {
  posterPath: string | null;
  genreIds?: number[];
  isActive?: boolean;
}

export function AmbientGlowFrame({
  posterPath,
  genreIds,
  isActive = true,
}: AmbientGlowFrameProps) {
  const reducedMotion = useReducedMotion();
  const { colors } = useDominantColors(posterPath, genreIds);
  const [isEnabled, setIsEnabled] = useState(true);

  // Load and sync localStorage toggle
  useEffect(() => {
    try {
      const stored = localStorage.getItem("flixverse-ambient-glow");
      if (stored !== null) {
        setIsEnabled(stored === "true");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Listen to custom event for setting changes
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      setIsEnabled(customEvent.detail.enabled);
    };
    window.addEventListener("toggle-ambient-glow", handleToggle);
    return () => window.removeEventListener("toggle-ambient-glow", handleToggle);
  }, []);

  if (!isActive || !isEnabled) return null;

  // Build the multi-layer radial gradient background
  const c1 = colors[0] ? rgbToCss(colors[0], 0.25) : "rgba(229,9,20,0.2)";
  const c2 = colors[1] ? rgbToCss(colors[1], 0.2) : "rgba(38,38,38,0.15)";
  const c3 = colors[2] ? rgbToCss(colors[2], 0.15) : "rgba(17,24,39,0.1)";
  const c4 = colors[3] ? rgbToCss(colors[3], 0.1) : "rgba(0,0,0,0.05)";

  const gradientStyle = {
    background: `
      radial-gradient(circle at 20% 30%, ${c1} 0%, transparent 50%),
      radial-gradient(circle at 80% 25%, ${c2} 0%, transparent 50%),
      radial-gradient(circle at 35% 75%, ${c3} 0%, transparent 60%),
      radial-gradient(circle at 70% 70%, ${c4} 0%, transparent 55%)
    `,
    transition: "background 800ms ease-in-out, opacity 800ms ease-in-out",
  };

  return (
    <div
      className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none filter blur-[120px] transition-opacity duration-800 ${
        reducedMotion ? "" : "animate-ambient-glow-pulse"
      }`}
      style={gradientStyle}
      aria-hidden="true"
    />
  );
}
