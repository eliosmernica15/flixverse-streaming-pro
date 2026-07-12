"use client";

import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, LOCALE_STORAGE_KEY, type Locale, locales } from "@/i18n/config";
import enMessages from "../../messages/en.json";

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Record<string, unknown>>(enMessages);

  useEffect(() => {
    let active: Locale = defaultLocale;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (stored && locales.includes(stored)) active = stored;
    } catch {
      /* ignore */
    }

    setLocale(active);
    if (active === defaultLocale) {
      setMessages(enMessages);
      return;
    }

    void import(`../../messages/${active}.json`).then((mod) => {
      setMessages(mod.default);
    });
  }, []);

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
    /* ignore */
  }
}
