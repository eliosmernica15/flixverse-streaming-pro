import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { CAPTION_LANGUAGES, CAPTION_LANG_STORAGE_KEY } from "@/lib/player/captionLanguages";
import {
  CAPTION_SIZE_STORAGE_KEY,
  CAPTION_STYLE_STORAGE_KEY,
  CAPTION_POSITION_STORAGE_KEY,
  CAPTION_OPACITY_STORAGE_KEY,
  CAPTION_OPACITY_DEFAULT,
  CAPTION_SIZES,
  CAPTION_STYLES,
  CAPTION_POSITIONS,
  loadCaptionSize,
  loadCaptionStyle,
  loadCaptionPosition,
  loadCaptionOpacity,
  type CaptionSize,
  type CaptionStyle,
  type CaptionPosition,
} from "@/lib/player/captionPreferences";
import { isSpoilerGuardEnabled, setSpoilerGuardEnabled } from "@/lib/player/spoilerGuard";

const LOCAL_UPDATED_KEY = "flixverse-caption-local-updated";
const SHOW_CAPTIONS_KEY = "flixverse-show-captions";

export interface SyncedPlayerSettings {
  lang: string;
  size: CaptionSize;
  style: CaptionStyle;
  position: CaptionPosition;
  opacity: number;
  showCaptions: boolean;
  spoilerGuard: boolean;
}

function loadShowCaptions(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SHOW_CAPTIONS_KEY) === "true";
}

function loadFromLocalStorage(): SyncedPlayerSettings {
  const savedLang = localStorage.getItem(CAPTION_LANG_STORAGE_KEY);
  return {
    lang:
      savedLang && CAPTION_LANGUAGES.some((l) => l.code === savedLang) ? savedLang : "en",
    size: loadCaptionSize(),
    style: loadCaptionStyle(),
    position: loadCaptionPosition(),
    opacity: loadCaptionOpacity(),
    showCaptions: loadShowCaptions(),
    spoilerGuard: isSpoilerGuardEnabled(),
  };
}

function saveToLocalStorage(prefs: SyncedPlayerSettings) {
  localStorage.setItem(CAPTION_LANG_STORAGE_KEY, prefs.lang);
  localStorage.setItem(CAPTION_SIZE_STORAGE_KEY, prefs.size);
  localStorage.setItem(CAPTION_STYLE_STORAGE_KEY, prefs.style);
  localStorage.setItem(CAPTION_POSITION_STORAGE_KEY, prefs.position);
  localStorage.setItem(CAPTION_OPACITY_STORAGE_KEY, String(prefs.opacity));
  localStorage.setItem(SHOW_CAPTIONS_KEY, String(prefs.showCaptions));
  setSpoilerGuardEnabled(prefs.spoilerGuard);
  localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.now()));
}

function toFirestorePayload(prefs: SyncedPlayerSettings) {
  return {
    captionLang: prefs.lang,
    captionSize: prefs.size,
    captionStyle: prefs.style,
    captionPosition: prefs.position,
    captionOpacity: prefs.opacity,
    showCaptions: prefs.showCaptions,
    spoilerGuardEnabled: prefs.spoilerGuard,
    updatedAt: Date.now(),
  };
}

function parseRemote(data: Record<string, unknown>): SyncedPlayerSettings | null {
  const lang = typeof data.captionLang === "string" ? data.captionLang : null;
  const size = typeof data.captionSize === "string" ? data.captionSize : null;
  const style = typeof data.captionStyle === "string" ? data.captionStyle : null;
  const position = typeof data.captionPosition === "string" ? data.captionPosition : null;
  const opacity = typeof data.captionOpacity === "number" ? data.captionOpacity : null;
  const showCaptions = typeof data.showCaptions === "boolean" ? data.showCaptions : null;
  const spoilerGuard =
    typeof data.spoilerGuardEnabled === "boolean" ? data.spoilerGuardEnabled : null;

  if (!lang && !size && !style && !position && opacity === null && showCaptions === null && spoilerGuard === null) {
    return null;
  }

  const local = loadFromLocalStorage();
  return {
    lang: lang && CAPTION_LANGUAGES.some((l) => l.code === lang) ? lang : local.lang,
    size: size && CAPTION_SIZES.some((s) => s.value === size) ? (size as CaptionSize) : local.size,
    style:
      style && CAPTION_STYLES.some((s) => s.value === style)
        ? (style as CaptionStyle)
        : local.style,
    position:
      position && CAPTION_POSITIONS.some((p) => p.value === position)
        ? (position as CaptionPosition)
        : local.position,
    opacity: opacity ?? local.opacity ?? CAPTION_OPACITY_DEFAULT,
    showCaptions: showCaptions ?? local.showCaptions,
    spoilerGuard: spoilerGuard ?? local.spoilerGuard,
  };
}

/** Player prefs with localStorage + Firestore sync for signed-in users. */
export function useSyncedCaptionPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<SyncedPlayerSettings>(loadFromLocalStorage);
  const [cloudSynced, setCloudSynced] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setPrefs(loadFromLocalStorage());
      setCloudSynced(false);
      seededRef.current = false;
      return;
    }

    let cancelled = false;
    const db = requireFirebaseDb();
    const ref = doc(db, "user_settings", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (cancelled) return;

        if (!snap.exists()) {
          if (!seededRef.current) {
            seededRef.current = true;
            const local = loadFromLocalStorage();
            void setDoc(ref, toFirestorePayload(local), { merge: true });
          }
          setCloudSynced(true);
          return;
        }

        const remote = parseRemote(snap.data());
        if (!remote) {
          setCloudSynced(true);
          return;
        }

        const remoteUpdated =
          typeof snap.data().updatedAt === "number" ? snap.data().updatedAt : 0;
        const localUpdated = parseInt(localStorage.getItem(LOCAL_UPDATED_KEY) || "0", 10);

        if (remoteUpdated >= localUpdated) {
          setPrefs(remote);
          saveToLocalStorage(remote);
        }
        setCloudSynced(true);
      },
      () => setCloudSynced(false)
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const persist = useCallback(
    (next: SyncedPlayerSettings) => {
      saveToLocalStorage(next);

      if (!user) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          const db = requireFirebaseDb();
          void setDoc(doc(db, "user_settings", user.uid), toFirestorePayload(next), { merge: true });
        } catch {
          // Firebase unavailable — local prefs still work
        }
      }, 350);
    },
    [user]
  );

  const update = useCallback(
    (updates: Partial<SyncedPlayerSettings>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...updates };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    captionLang: prefs.lang,
    captionSize: prefs.size,
    captionStyle: prefs.style,
    captionPosition: prefs.position,
    captionOpacity: prefs.opacity,
    showCaptions: prefs.showCaptions,
    spoilerGuard: prefs.spoilerGuard,
    setCaptionLang: (lang: string) => update({ lang }),
    setCaptionSize: (size: CaptionSize) => update({ size }),
    setCaptionStyle: (style: CaptionStyle) => update({ style }),
    setCaptionPosition: (position: CaptionPosition) => update({ position }),
    setCaptionOpacity: (opacity: number) => update({ opacity }),
    setShowCaptions: (showCaptions: boolean) => update({ showCaptions }),
    setSpoilerGuard: (spoilerGuard: boolean) => update({ spoilerGuard }),
    cloudSynced,
  };
}
