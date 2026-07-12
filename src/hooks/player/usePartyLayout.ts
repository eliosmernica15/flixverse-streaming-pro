import { useCallback, useEffect, useState } from "react";

export type CameraLayoutMode = "side" | "bottom" | "grid" | "hidden";
export type PartyFocusLevel = 0 | 1 | 2 | 3;

const CAMERA_KEY = "flixverse-party-camera-layout";
const FOCUS_LABELS = ["Standard", "Roomier", "Spacious", "Widest"] as const;

export function usePartyLayout() {
  const [cameraLayout, setCameraLayoutState] = useState<CameraLayoutMode>("side");
  const [focusLevel, setFocusLevel] = useState<PartyFocusLevel>(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CAMERA_KEY) as CameraLayoutMode | null;
      if (stored && ["side", "bottom", "grid", "hidden"].includes(stored)) {
        setCameraLayoutState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setCameraLayout = useCallback((mode: CameraLayoutMode) => {
    setCameraLayoutState(mode);
    try {
      localStorage.setItem(CAMERA_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  /** Each click grows the player; at max, next click resets to standard. */
  const cycleFocusLevel = useCallback(() => {
    setFocusLevel((prev) => (prev >= 3 ? 0 : ((prev + 1) as PartyFocusLevel)));
  }, []);

  const resetFocusLevel = useCallback(() => {
    setFocusLevel(0);
  }, []);

  return {
    cameraLayout,
    setCameraLayout,
    focusLevel,
    focusLabel: FOCUS_LABELS[focusLevel],
    cycleFocusLevel,
    resetFocusLevel,
    showPartyPanel: focusLevel < 1,
    showCameras: focusLevel < 2 && cameraLayout !== "hidden",
    isCinemaMode: false,
    isMaxBoost: focusLevel >= 3,
  };
}
