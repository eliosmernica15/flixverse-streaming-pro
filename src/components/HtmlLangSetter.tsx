"use client";

import { useEffect } from "react";
import { getStoredLocale, localeToHtmlLang } from "@/i18n/config";

/** Sets document.documentElement.lang from stored locale. */
export function HtmlLangSetter() {
  useEffect(() => {
    document.documentElement.lang = localeToHtmlLang(getStoredLocale());
  }, []);

  return null;
}
