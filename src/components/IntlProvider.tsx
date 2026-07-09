"use client";

import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, LOCALE_STORAGE_KEY, type Locale, locales } from "@/i18n/config";

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active: Locale = defaultLocale;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (stored && locales.includes(stored)) active = stored;
    } catch {
      // ignore
    }
    setLocale(active);
    void import(`../../messages/${active}.json`).then((mod) => {
      setMessages(mod.default);
    });
  }, []);

  if (!messages) return <>{children}</>;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function setAppLocale(locale: Locale) {
  if (!locales.includes(locale)) return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale};path=/;max-age=31536000`;
    window.location.reload();
  } catch {
    // ignore
  }
}
