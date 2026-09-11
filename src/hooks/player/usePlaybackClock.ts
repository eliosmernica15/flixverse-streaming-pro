import { useState, useEffect, useRef, useCallback } from "react";
import { useWatchHistory } from "@/hooks/useWatchHistory";

interface UsePlaybackClockProps {
  movieId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  season?: number;
  episode?: number;
  initialPosition?: number;
  totalDuration?: number;
  isPlaying: boolean;
}

export function usePlaybackClock({
  movieId,
  mediaType,
  title,
  posterPath,
  season,
  episode,
  initialPosition = 0,
  totalDuration = 120 * 60, // default 2 hours if not provided
  isPlaying,
}: UsePlaybackClockProps) {
  const [currentTime, setCurrentTime] = useState(initialPosition);
  const { updateProgress } = useWatchHistory();

  const currentTimeRef = useRef(initialPosition);
  const isPlayingRef = useRef(isPlaying);
  const lastTickRef = useRef<number | null>(null);
  const lastPersistRef = useRef<number>(Date.now());
  const totalDurationRef = useRef(totalDuration);
  // Rendered time is throttled: the ref stays frame-accurate for sync math,
  // but React state (and the whole player subtree re-render) updates at
  // most 4x/second. Rendering 60fps melted low-end machines.
  const lastRenderedRef = useRef(initialPosition);
  const RENDER_EVERY_SEC = 0.25;
  // Guard against persist pile-up: while the Python API is timing out,
  // every 5s tick would fire another hanging POST until the browser hits
  // ERR_INSUFFICIENT_RESOURCES. Skip while one is in flight and back off
  // 30s after a failure.
  const persistInFlightRef = useRef(false);
  const persistBlockedUntilRef = useRef(0);

  // Sync refs to avoid re-running effects
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTickRef.current = performance.now();
    } else {
      lastTickRef.current = null;
    }
  }, [isPlaying]);

  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  // Handle initialization/resets (e.g. on source or episode change)
  useEffect(() => {
    setCurrentTime(initialPosition);
    currentTimeRef.current = initialPosition;
    lastRenderedRef.current = initialPosition;
    lastTickRef.current = isPlaying ? performance.now() : null;
    lastPersistRef.current = Date.now();
  }, [initialPosition, movieId, season, episode, isPlaying]);

  // Persist function
  const persistProgress = useCallback(async (time: number) => {
    if (persistInFlightRef.current) return;
    if (Date.now() < persistBlockedUntilRef.current) return;
    persistInFlightRef.current = true;
    try {
      await updateProgress(
        movieId,
        mediaType,
        title,
        posterPath,
        Math.floor(time),
        totalDurationRef.current,
        season,
        episode
      );
      lastPersistRef.current = Date.now();
    } catch (err) {
      console.error("Failed to persist watch progress:", err);
      persistBlockedUntilRef.current = Date.now() + 30000;
    } finally {
      persistInFlightRef.current = false;
    }
  }, [movieId, mediaType, title, posterPath, season, episode, updateProgress]);

  // RequestAnimationFrame tick loop
  useEffect(() => {
    let animationFrameId: number;

    const tick = (now: number) => {
      if (isPlayingRef.current && lastTickRef.current !== null) {
        const delta = (now - lastTickRef.current) / 1000; // in seconds
        let nextTime = currentTimeRef.current + delta;

        // Bound to duration
        if (nextTime >= totalDurationRef.current) {
          nextTime = totalDurationRef.current;
          isPlayingRef.current = false;
        }

        currentTimeRef.current = nextTime;
        if (Math.abs(nextTime - lastRenderedRef.current) >= RENDER_EVERY_SEC) {
          lastRenderedRef.current = nextTime;
          setCurrentTime(nextTime);
        }

        // Auto-persist every 5 seconds
        if (Date.now() - lastPersistRef.current >= 5000) {
          void persistProgress(nextTime);
        }
      }
      lastTickRef.current = now;
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
      // Persist final progress on unmount
      if (currentTimeRef.current > initialPosition) {
        void persistProgress(currentTimeRef.current);
      }
    };
  }, [persistProgress, initialPosition]);

  const seekTo = useCallback((seconds: number) => {
    const bounded = Math.max(0, Math.min(seconds, totalDurationRef.current));
    currentTimeRef.current = bounded;
    setCurrentTime(bounded);
    lastTickRef.current = isPlayingRef.current ? performance.now() : null;
    void persistProgress(bounded);
  }, [persistProgress]);

  /**
   * Correct the clock from a live embed event without forcing an immediate
   * Firestore persist (providers can emit timeupdate several times a second;
   * the regular 5s persist cadence picks the value up).
   */
  const syncTo = useCallback((seconds: number) => {
    const bounded = Math.max(0, Math.min(seconds, totalDurationRef.current));
    currentTimeRef.current = bounded;
    setCurrentTime(bounded);
    lastTickRef.current = isPlayingRef.current ? performance.now() : null;
  }, []);

  return {
    currentTime,
    totalDuration,
    seekTo,
    syncTo,
  };
}
