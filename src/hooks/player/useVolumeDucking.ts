import { useEffect, useRef } from "react";

/** How far the film is dropped while somebody is speaking. */
const DUCK_RATIO = 0.42;
/** Below this the film is effectively inaudible, even when ducked. */
const DUCK_FLOOR = 0.12;
/** Hold the duck briefly across natural pauses between words. */
const RESTORE_DELAY_MS = 420;

interface UseVolumeDuckingOptions {
  enabled: boolean;
  anyoneSpeaking: boolean;
  baseVolume: number;
  setVolume: (volume: number) => void;
}

/**
 * Lowers the film's volume while a party member is speaking.
 *
 * The subtle bug this hook used to have: `baseVolume` is the *live* embed
 * volume, so the moment we ducked it, the next render passed the ducked value
 * back in as the new "base". Restoring then returned the user to the quiet
 * level, and every subsequent duck compounded it downward until the film was
 * silent. The user's chosen volume is now latched the first time we duck and
 * is only replaced by a value the user themselves set (a change that arrives
 * while we are *not* ducking).
 */
export function useVolumeDucking({
  enabled,
  anyoneSpeaking,
  baseVolume,
  setVolume,
}: UseVolumeDuckingOptions) {
  /** The volume the user actually wants, independent of our own ducking. */
  const userVolumeRef = useRef(baseVolume);
  const duckedRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedRef = useRef(baseVolume);

  // Track user intent. A change arriving while we are ducking is our own
  // attenuation echoing back, not a user action — ignore it.
  useEffect(() => {
    if (duckedRef.current) return;
    if (Math.abs(baseVolume - lastAppliedRef.current) < 1e-3) return;
    userVolumeRef.current = baseVolume;
    lastAppliedRef.current = baseVolume;
  }, [baseVolume]);

  useEffect(() => {
    const clearRestore = () => {
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    };

    if (!enabled) {
      clearRestore();
      if (duckedRef.current) {
        duckedRef.current = false;
        lastAppliedRef.current = userVolumeRef.current;
        setVolume(userVolumeRef.current);
      }
      return;
    }

    if (anyoneSpeaking) {
      clearRestore();
      duckedRef.current = true;
      const target = Math.max(DUCK_FLOOR, userVolumeRef.current * DUCK_RATIO);
      lastAppliedRef.current = target;
      setVolume(target);
      return () => clearRestore();
    }

    // Speech stopped — hold the duck briefly, then restore exactly once.
    if (duckedRef.current && !restoreTimerRef.current) {
      restoreTimerRef.current = setTimeout(() => {
        restoreTimerRef.current = null;
        if (!duckedRef.current) return;
        duckedRef.current = false;
        lastAppliedRef.current = userVolumeRef.current;
        setVolume(userVolumeRef.current);
      }, RESTORE_DELAY_MS);
    }

    return () => clearRestore();
  }, [enabled, anyoneSpeaking, setVolume]);

  // Never leave the film quiet because the component unmounted mid-duck.
  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, []);
}
