const RESERVED = new Set([
  "admin",
  "api",
  "auth",
  "help",
  "login",
  "logout",
  "movie",
  "movies",
  "party",
  "plans",
  "profile",
  "search",
  "settings",
  "support",
  "terms",
  "tv",
  "u",
  "user",
  "flixverse",
  "flix",
  "null",
  "undefined",
]);

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeUsername(raw);
  if (!value) return { ok: false, error: "Username is required" };
  if (value.length < 3) return { ok: false, error: "At least 3 characters" };
  if (value.length > 20) return { ok: false, error: "Maximum 20 characters" };
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: "Use lowercase letters, numbers, and underscores only" };
  }
  if (RESERVED.has(value)) return { ok: false, error: "This username is reserved" };
  return { ok: true, value };
}
