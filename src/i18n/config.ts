export const locales = ["en", "es", "sq"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const LOCALE_STORAGE_KEY = "flixverse-locale";

const TMDB_LANGUAGE_MAP: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  sq: "sq-AL",
};

const HTML_LANG_MAP: Record<Locale, string> = {
  en: "en",
  es: "es",
  sq: "sq",
};

export function localeToTmdbLanguage(locale: Locale): string {
  return TMDB_LANGUAGE_MAP[locale] ?? TMDB_LANGUAGE_MAP.en;
}

export function localeToHtmlLang(locale: Locale): string {
  return HTML_LANG_MAP[locale] ?? HTML_LANG_MAP.en;
}

export function isValidLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

/** Read stored locale from localStorage (client) or return default. */
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isValidLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return defaultLocale;
}

/** TMDB language code for the active app locale. */
export function getCurrentTmdbLanguage(): string {
  return localeToTmdbLanguage(getStoredLocale());
}

/** Append locale to React Query keys so caches are per-language. */
export function localeQueryKey<T extends readonly unknown[]>(
  base: T,
  locale?: Locale
): readonly [...T, Locale] {
  const loc = locale ?? getStoredLocale();
  return [...base, loc] as readonly [...T, Locale];
}
