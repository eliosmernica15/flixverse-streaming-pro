"use client";

import { Globe } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { setAppLocale } from "@/components/IntlProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "next-intl";

const LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-ring"
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{LABELS[locale] ?? locale}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setAppLocale(loc)}
            className={locale === loc ? "font-semibold text-red-400" : ""}
          >
            {LABELS[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
