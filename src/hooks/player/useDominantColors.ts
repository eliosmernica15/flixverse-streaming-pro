import { useState, useEffect } from "react";
import { extractDominantColors, RGBColor, DEFAULT_PALETTE } from "@/lib/player/extractDominantColors";

export function useDominantColors(imageUrl: string | null | undefined, genreIds?: number[]) {
  const [colors, setColors] = useState<RGBColor[]>(DEFAULT_PALETTE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setColors(DEFAULT_PALETTE);
      return;
    }

    // Check sessionStorage cache
    const cacheKey = `dominant_colors:${imageUrl}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setColors(JSON.parse(cached));
        return;
      }
    } catch {
      // ignore storage errors
    }

    setLoading(true);

    const runExtraction = () => {
      extractDominantColors(imageUrl, genreIds).then((palette) => {
        setColors(palette);
        setLoading(false);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(palette));
        } catch {
          // ignore storage errors
        }
      });
    };

    // Use requestIdleCallback if available, fallback to setTimeout
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(runExtraction);
      return () => {
        (window as Window & { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(handle);
      };
    } else {
      const handle = setTimeout(runExtraction, 100);
      return () => clearTimeout(handle);
    }
  }, [imageUrl, genreIds]);

  return { colors, loading };
}
