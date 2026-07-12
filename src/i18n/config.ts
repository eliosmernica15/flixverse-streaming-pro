export const locales = ["en", "es", "sq"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const LOCALE_STORAGE_KEY = "flixverse-locale";
