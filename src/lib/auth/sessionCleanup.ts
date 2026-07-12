const AUTH_STORAGE_PREFIXES = ["firebase:", "flixverse-auth", "flixverse-party-voice-volume"];

const PRESERVE_LOCAL_KEYS = new Set([
  "flixverse-ambient-glow",
  "flixverse-playback-rate",
  "userPreferences",
  "myMovieList",
  "cookie-consent",
]);

/** Clear auth-related client storage without wiping guest preferences. */
export function clearAuthClientStorage() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      const lower = key.toLowerCase();
      const isAuth =
        AUTH_STORAGE_PREFIXES.some((p) => lower.startsWith(p)) ||
        lower.includes("auth") ||
        lower.includes("token");
      if (isAuth && !PRESERVE_LOCAL_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      void caches.keys().then((names) => {
        for (const name of names) {
          if (name.includes("auth") || name.includes("firebase")) {
            void caches.delete(name);
          }
        }
      });
    }
  } catch {
    // ignore
  }
}
