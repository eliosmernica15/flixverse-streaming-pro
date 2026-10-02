const SPOILER_GUARD_KEY = "flixverse-spoiler-guard";

export function isSpoilerGuardEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SPOILER_GUARD_KEY) !== "false";
}

export function setSpoilerGuardEnabled(enabled: boolean): void {
  localStorage.setItem(SPOILER_GUARD_KEY, String(enabled));
}
