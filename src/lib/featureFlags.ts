/**
 * Feature flags — client-side kill switches and toggles.
 * Reads from localStorage override or environment defaults.
 * Can be extended to use Firebase Remote Config or Vercel Flags.
 */

const FLAG_PREFIX = "flixverse-flag-";

interface FlagConfig {
  defaultValue: boolean;
  description: string;
}

const FLAGS: Record<string, FlagConfig> = {
  "timeline-comments": { defaultValue: true, description: "Timeline comments on player scrubber" },
  "flixparty": { defaultValue: true, description: "FlixParty co-watching feature" },
  "ambient-glow": { defaultValue: true, description: "Ambient backlight effect on player" },
  "spoiler-guard": { defaultValue: true, description: "Progressive spoiler protection" },
  "offline-sync": { defaultValue: true, description: "Offline PWA sync outbox" },
  "card-preview": { defaultValue: true, description: "Netflix-style card hover preview panel" },
  "top10-row": { defaultValue: true, description: "Top 10 ranked row on home page" },
  "browse-mega-menu": { defaultValue: true, description: "Browse mega-menu in navigation" },
  "person-pages": { defaultValue: true, description: "Person detail pages (/person/[id])" },
  "multi-profile": { defaultValue: true, description: "Multi-profile system" },
  "search-filters": { defaultValue: true, description: "Search result filters" },
  "infinite-scroll": { defaultValue: true, description: "Infinite scroll on browse/search" },
};

export function isFeatureEnabled(flagName: string): boolean {
  const config = FLAGS[flagName];
  if (!config) return false;

  // Check localStorage override
  if (typeof window !== "undefined") {
    try {
      const override = localStorage.getItem(`${FLAG_PREFIX}${flagName}`);
      if (override !== null) {
        return override === "true";
      }
    } catch {
      // ignore
    }
  }

  return config.defaultValue;
}

export function setFeatureFlag(flagName: string, enabled: boolean) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${FLAG_PREFIX}${flagName}`, String(enabled));
    } catch {
      // ignore
    }
  }
}

export function getAllFlags(): Record<string, { enabled: boolean; description: string }> {
  const result: Record<string, { enabled: boolean; description: string }> = {};
  for (const [name, config] of Object.entries(FLAGS)) {
    result[name] = {
      enabled: isFeatureEnabled(name),
      description: config.description,
    };
  }
  return result;
}

export function resetAllFlags() {
  if (typeof window !== "undefined") {
    for (const name of Object.keys(FLAGS)) {
      try {
        localStorage.removeItem(`${FLAG_PREFIX}${name}`);
      } catch {
        // ignore
      }
    }
  }
}
