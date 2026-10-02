import { useEffect, useRef, useCallback } from "react";
import {
  createAudioDucker,
  setupMovieAudioDucking,
  applyDucking,
  teardownAudioDucking,
} from "@/lib/player/audioDucker";

const DUCK_RATIO = 0.35; // ~65 % attenuation (1 - 0.65)
const RESTORE_MS = 400;
const SPEAK_THRESHOLD_DBS = -42;
const SILENCE_TIMEOUT_MS = 1200;
const RAMP_MS = 150;

interface UseVolumeDuckingOptions {
  enabled: boolean;
  anyoneSpeaking: boolean;
  baseVolume: number;
  setVolume: (volume: number) => void;
  movieAudioElement?: HTMLAudioElement | HTMLVideoElement | null;
}

/** Lowers movie volume smoothly while someone in the party is speaking. */
export function useVolumeDucking({
  enabled,
  anyoneSpeaking,
  baseVolume,
  setVolume,
  movieAudioElement = null,
}: UseVolumeDuckingOptions) {
  const savedVolumeRef = useRef(baseVolume);
  const duckingRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioDuckerStateRef = useRef(createAudioDucker());

  // Initialize / teardown audio node when movie element changes
  useEffect(() => {
    if (enabled && movieAudioElement) {
      setupMovieAudioDucking(movieAudioElement, audioDuckerStateRef.current);
    }
  }, [enabled, movieAudioElement]);

  useEffect(() => {
    savedVolumeRef.current = baseVolume;
    if (!duckingRef.current) {
      setVolume(baseVolume);
    }
  }, [baseVolume, setVolume]);

  useEffect(() => {
    if (!enabled) {
      duckingRef.current = false;
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      if (audioDuckerStateRef.current.duckTimer) {
        clearTimeout(audioDuckerStateRef.current.duckTimer);
        audioDuckerStateRef.current.duckTimer = null;
      }
      setVolume(savedVolumeRef.current);
      teardownAudioDucking(audioDuckerStateRef.current);
      return () => {
        teardownAudioDucking(audioDuckerStateRef.current);
      };
    }

    // Apply smooth ducking via Web Audio API singleton when movie element available
    if (movieAudioElement && audioDuckerStateRef.current.gainNode) {
      applyDucking(anyoneSpeaking, audioDuckerStateRef.current);
    } else {
      // Fallback: abrupt volume set for browsers without audio node access
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
    }

    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, [enabled, anyoneSpeaking, baseVolume, setVolume, movieAudioElement]);

  return audioDuckerStateRef.current;
}
