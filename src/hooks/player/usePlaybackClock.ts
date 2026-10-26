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

/** How often React state is refreshed from the frame-accurate ref. */
const RENDER_EVERY_SEC = 0.25;
/** Watch-progress write cadence. */
const PERSIST_EVERY_MS = 5000;
/** Back-off after a failed persist before trying again. */
const PERSIST_BACKOFF_MS = 30_000;

function documentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * A frame-accurate playback clock driven by `requestAnimationFrame`.
 *
 * The ref (`currentTimeRef`) is authoritative and advances every frame for
 * exact party-sync math; React state is published at 4 Hz so the player
 * subtree does not re-render at 60 fps.
 *
 * The loop **parks** whenever playback is paused, the tab is hidden, or the
 * movie has ended, and wakes on play or on visibility restore. A
 * permanently-scheduled rAF is a 60 Hz wake-up for the entire runtime of a
 * film — measurable battery drain and it prevents the main thread from ever
 * idling while a cross-origin embed is playing.
 */
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
  const lastRenderedRef = useRef(initialPosition);
  /** Set by the play effect, consumed by the loop to start scheduling. */
  const wakeRequestRef = useRef(false);
  // Guard against persist pile-up: while the Python API is timing out,
  // every 5s tick would fire another hanging POST until the browser hits
  // ERR_INSUFFICIENT_RESOURCES. Skip while one is in flight and back off
  // 30s after a failure.
  const persistInFlightRef = useRef(false);
  const persistBlockedUntilRef = useRef(0);

  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  // Handle initialization/resets (e.g. on source or episode change).
  //
  // `isPlaying` is deliberately NOT a dependency: play/pause is handled by the
  // loop effect below (which re-anchors the tick). Including it here made
  // every pause→play toggle reset the playhead to `initialPosition`, which in
  // a watch party then propagated to every guest through the host heartbeat —
  // the "pause and the whole room desyncs" symptom.
  useEffect(() => {
    setCurrentTime(initialPosition);
    currentTimeRef.current = initialPosition;
    lastRenderedRef.current = initialPosition;
    lastTickRef.current = isPlayingRef.current ? performance.now() : null;
    lastPersistRef.current = Date.now();
    // isPlaying is read to anchor the tick, not to trigger a reset.
  }, [initialPosition, movieId, season, episode]);

  const persistProgress = useCallback(
    async (time: number) => {
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
        persistBlockedUntilRef.current = Date.now() + PERSIST_BACKOFF_MS;
      } finally {
        persistInFlightRef.current = false;
      }
    },
    [movieId, mediaType, title, posterPath, season, episode, updateProgress]
  );

  // The tick loop. `running` and `frameId` live in this closure so the only
  // way to schedule a frame is through `schedule()`, which is idempotent.
  useEffect(() => {
    let frameId = 0;
    let running = false;

    const tick = (now: number) => {
      running = false;

      if (isPlayingRef.current && lastTickRef.current !== null) {
        const delta = (now - lastTickRef.current) / 1000;
        let nextTime = currentTimeRef.current + delta;

        if (nextTime >= totalDurationRef.current) {
          nextTime = totalDurationRef.current;
          isPlayingRef.current = false;
        }

        currentTimeRef.current = nextTime;
        if (Math.abs(nextTime - lastRenderedRef.current) >= RENDER_EVERY_SEC) {
          lastRenderedRef.current = nextTime;
          setCurrentTime(nextTime);
        }

        if (Date.now() - lastPersistRef.current >= PERSIST_EVERY_MS) {
          void persistProgress(nextTime);
        }
      }

      lastTickRef.current = now;

      if (shouldRun()) schedule();
    };

    function shouldRun(): boolean {
      return isPlayingRef.current && !documentHidden();
    }

    function schedule() {
      if (running) return;
      running = true;
      frameId = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    }

    // Public wake channel for the play effect: only schedules when the loop
    // is allowed to run. Exposed through `wakeRef` below.
    const wake = () => {
      if (wakeRequestRef.current) wakeRequestRef.current = false;
      if (shouldRun()) schedule();
    };
    wakeRef.current = wake;

    const onVisibility = () => {
      if (documentHidden()) {
        stop();
        return;
      }
      if (isPlayingRef.current) {
        // Re-anchor so the gap spent hidden is not added to the playhead.
        lastTickRef.current = performance.now();
        schedule();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    schedule();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wakeRef.current = null;
      stop();
      // Persist final progress on unmount.
      if (currentTimeRef.current > initialPosition) {
        void persistProgress(currentTimeRef.current);
      }
    };
  }, [persistProgress, initialPosition]);

  // Stable wake handle shared between the loop effect and the play effect.
  const wakeRef = useRef<(() => void) | null>(null);

  // Play/pause transitions must start or stop the loop immediately; without
  // this a resume waits for the next visibility change.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTickRef.current = performance.now();
      wakeRequestRef.current = true;
      wakeRef.current?.();
    } else {
      lastTickRef.current = null;
    }
  }, [isPlaying]);

  const seekTo = useCallback(
    (seconds: number) => {
      const bounded = Math.max(0, Math.min(seconds, totalDurationRef.current));
      currentTimeRef.current = bounded;
      lastRenderedRef.current = bounded;
      setCurrentTime(bounded);
      lastTickRef.current = isPlayingRef.current ? performance.now() : null;
      void persistProgress(bounded);
    },
    [persistProgress]
  );

  /**
   * Correct the clock from a live embed event without forcing an immediate
   * watch-history write (providers emit timeupdate several times a second;
   * the regular persist cadence picks the value up).
   */
  const syncTo = useCallback((seconds: number) => {
    const bounded = Math.max(0, Math.min(seconds, totalDurationRef.current));
    currentTimeRef.current = bounded;
    lastRenderedRef.current = bounded;
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
