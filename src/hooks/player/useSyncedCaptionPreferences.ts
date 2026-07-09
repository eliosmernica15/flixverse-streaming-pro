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

const LOCAL_UPDATED_KEY = "flixverse-caption-local-updated";

export interface SyncedCaptionPreferences {
  lang: string;
  size: CaptionSize;
  style: CaptionStyle;
  position: CaptionPosition;
  opacity: number;
}

function loadFromLocalStorage(): SyncedCaptionPreferences {
  const savedLang = localStorage.getItem(CAPTION_LANG_STORAGE_KEY);
  return {
    lang:
      savedLang && CAPTION_LANGUAGES.some((l) => l.code === savedLang) ? savedLang : "en",
    size: loadCaptionSize(),
    style: loadCaptionStyle(),
    position: loadCaptionPosition(),
    opacity: loadCaptionOpacity(),
  };
}

function saveToLocalStorage(prefs: SyncedCaptionPreferences) {
  localStorage.setItem(CAPTION_LANG_STORAGE_KEY, prefs.lang);
  localStorage.setItem(CAPTION_SIZE_STORAGE_KEY, prefs.size);
  localStorage.setItem(CAPTION_STYLE_STORAGE_KEY, prefs.style);
  localStorage.setItem(CAPTION_POSITION_STORAGE_KEY, prefs.position);
  localStorage.setItem(CAPTION_OPACITY_STORAGE_KEY, String(prefs.opacity));
  localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.now()));
}

function parseRemote(data: Record<string, unknown>): SyncedCaptionPreferences | null {
  const lang = typeof data.captionLang === "string" ? data.captionLang : null;
  const size = typeof data.captionSize === "string" ? data.captionSize : null;
  const style = typeof data.captionStyle === "string" ? data.captionStyle : null;
  const position = typeof data.captionPosition === "string" ? data.captionPosition : null;
  const opacity = typeof data.captionOpacity === "number" ? data.captionOpacity : null;

  if (!lang && !size && !style && !position && opacity === null) return null;

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
  };
}

/** Caption prefs with localStorage + Firestore sync for signed-in users. */
export function useSyncedCaptionPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<SyncedCaptionPreferences>(loadFromLocalStorage);
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
            void setDoc(
              ref,
              {
                captionLang: local.lang,
                captionSize: local.size,
                captionStyle: local.style,
                captionPosition: local.position,
                captionOpacity: local.opacity,
                updatedAt: Date.now(),
              },
              { merge: true }
            );
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
    (next: SyncedCaptionPreferences) => {
      saveToLocalStorage(next);

      if (!user) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          const db = requireFirebaseDb();
          void setDoc(
            doc(db, "user_settings", user.uid),
            {
              captionLang: next.lang,
              captionSize: next.size,
              captionStyle: next.style,
              captionPosition: next.position,
              captionOpacity: next.opacity,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } catch {
          // Firebase unavailable — local prefs still work
        }
      }, 350);
    },
    [user]
  );

  const update = useCallback(
    (updates: Partial<SyncedCaptionPreferences>) => {
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
    setCaptionLang: (lang: string) => update({ lang }),
    setCaptionSize: (size: CaptionSize) => update({ size }),
    setCaptionStyle: (style: CaptionStyle) => update({ style }),
    setCaptionPosition: (position: CaptionPosition) => update({ position }),
    setCaptionOpacity: (opacity: number) => update({ opacity }),
    cloudSynced,
  };
}
