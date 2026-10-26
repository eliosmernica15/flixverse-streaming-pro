import { useState, useEffect, useRef } from "react";
import { extractDominantColors, RGBColor, DEFAULT_PALETTE } from "@/lib/player/extractDominantColors";

export function useDominantColors(imageUrl: string | null | undefined, genreIds?: number[]) {
  const [colors, setColors] = useState<RGBColor[]>(DEFAULT_PALETTE);
  const [loading, setLoading] = useState(false);

  // `genreIds` arrives as a fresh array from the API on many renders; keying
  // the effect on its identity re-ran the whole extraction (and cancelled the
  // in-flight one) on every render, so a poster could sit on the default red
  // palette forever. The effect depends on the *contents* instead.
  const genreKey = Array.isArray(genreIds) ? genreIds.join(",") : "";
  const genreIdsRef = useRef<number[] | undefined>(genreIds);
  genreIdsRef.current = genreIds;

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
        const parsed = JSON.parse(cached) as RGBColor[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColors(parsed);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    let cancelled = false;
    setLoading(true);

    const runExtraction = () => {
      extractDominantColors(imageUrl, genreIdsRef.current).then((palette) => {
        if (cancelled) return;
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
      const idleWindow = window as Window & {
        requestIdleCallback: (cb: () => void) => number;
        cancelIdleCallback?: (h: number) => void;
      };
      const handle = idleWindow.requestIdleCallback(runExtraction);
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const handle = setTimeout(runExtraction, 100);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [imageUrl, genreKey]);

  return { colors, loading };
}
