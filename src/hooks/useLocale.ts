"use client";

import { useEffect, useState } from "react";
import { defaultLocale, getStoredLocale, type Locale } from "@/i18n/config";

/** Reactive locale for React Query keys and client-side logic. */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  return locale;
}
