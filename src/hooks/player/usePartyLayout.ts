import { useCallback, useEffect, useState } from "react";

export type CameraLayoutMode = "side" | "bottom" | "grid" | "hidden";
export type PartyFocusLevel = 0 | 1 | 2 | 3;
export type PartyPanelMode = "closed" | "minimized" | "expanded";

const CAMERA_KEY = "flixverse-party-camera-layout";
const FOCUS_LABELS = ["Standard", "Roomier", "Spacious", "Widest"] as const;
const MOBILE_BREAKPOINT = 768;

export function usePartyLayout() {
  const [cameraLayout, setCameraLayoutState] = useState<CameraLayoutMode>("side");
  const [focusLevel, setFocusLevel] = useState<PartyFocusLevel>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [partyPanelMode, setPartyPanelMode] = useState<PartyPanelMode>("closed");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  }, []);

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

  const cycleFocusLevel = useCallback(() => {
    setFocusLevel((prev) => (prev >= 3 ? 0 : ((prev + 1) as PartyFocusLevel)));
  }, []);

  const resetFocusLevel = useCallback(() => {
    setFocusLevel(0);
  }, []);

  const expandPartyPanel = useCallback(() => {
    setPartyPanelMode("expanded");
  }, []);

  const minimizePartyPanel = useCallback(() => {
    setPartyPanelMode("minimized");
  }, []);

  const closePartyPanel = useCallback(() => {
    setPartyPanelMode("closed");
  }, []);

  /** Default mobile join: collapsed bar, not half-screen panel */
  const prepareMobilePartyJoin = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setPartyPanelMode("minimized");
      setCameraLayoutState((prev) => (prev === "side" ? "bottom" : prev));
    }
  }, []);

  const resetPartyPanelMode = useCallback(() => {
    setPartyPanelMode("closed");
  }, []);

  const effectiveCameraLayout: CameraLayoutMode =
    isMobile && cameraLayout === "side" ? "bottom" : cameraLayout;

  return {
    cameraLayout,
    effectiveCameraLayout,
    setCameraLayout,
    focusLevel,
    focusLabel: FOCUS_LABELS[focusLevel],
    cycleFocusLevel,
    resetFocusLevel,
    showPartyPanel: focusLevel < 1,
    showCameras: focusLevel < 2 && cameraLayout !== "hidden",
    isCinemaMode: false,
    isMaxBoost: focusLevel >= 3,
    isMobile,
    partyPanelMode,
    setPartyPanelMode,
    expandPartyPanel,
    minimizePartyPanel,
    closePartyPanel,
    prepareMobilePartyJoin,
    resetPartyPanelMode,
  };
}
