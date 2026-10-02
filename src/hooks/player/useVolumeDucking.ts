import { useEffect, useRef } from "react";

const DUCK_RATIO = 0.42;
const RESTORE_MS = 400;

interface UseVolumeDuckingOptions {
  enabled: boolean;
  anyoneSpeaking: boolean;
  baseVolume: number;
  setVolume: (volume: number) => void;
}

/** Lowers movie volume while someone in the party is speaking. */
export function useVolumeDucking({
  enabled,
  anyoneSpeaking,
  baseVolume,
  setVolume,
}: UseVolumeDuckingOptions) {
  const savedVolumeRef = useRef(baseVolume);
  const duckingRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedVolumeRef.current = baseVolume;
    if (!duckingRef.current) setVolume(baseVolume);
  }, [baseVolume, setVolume]);

  useEffect(() => {
    if (!enabled) {
      duckingRef.current = false;
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      setVolume(savedVolumeRef.current);
      return;
    }

    if (anyoneSpeaking) {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      if (!duckingRef.current) {
        savedVolumeRef.current = baseVolume;
        duckingRef.current = true;
      }
      setVolume(Math.max(0.08, savedVolumeRef.current * DUCK_RATIO));
    } else if (duckingRef.current) {
      restoreTimerRef.current = setTimeout(() => {
        duckingRef.current = false;
        setVolume(savedVolumeRef.current);
      }, RESTORE_MS);
    }

    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, [enabled, anyoneSpeaking, baseVolume, setVolume]);
}
