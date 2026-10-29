"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { OPEN_COMMAND_PALETTE_EVENT } from "@/hooks/useGlobalShortcuts";

/**
 * The command palette's visible entry point.
 *
 * It only dispatches {@link OPEN_COMMAND_PALETTE_EVENT} — it does not render the
 * palette itself. That keeps the palette a single instance mounted at the app
 * root, so the button, the Ctrl+K accelerator and any future trigger all open
 * the same dialog instead of racing separate copies of it.
 */
export default function NavSearchButton() {
  const t = useTranslations("search");

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
      aria-label={t("ariaLabel")}
      aria-keyshortcuts="Control+K Meta+K"
      title={`${t("ariaLabel")} (Ctrl K)`}
      className="group flex h-9 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-gray-300 transition-colors duration-200 hover:border-red-400/40 hover:bg-white/10 hover:text-white focus-ring sm:px-3"
    >
      <Search className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-red-300" aria-hidden="true" />
      <span className="hidden max-w-[12rem] truncate text-[11px] font-medium text-gray-400 transition-colors group-hover:text-gray-200 md:block">
        {t("placeholder")}
      </span>
      {/* A keyboard hint is noise on touch devices, where there is no Ctrl key. */}
      <kbd className="hidden select-none items-center gap-0.5 rounded-md border border-white/15 bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-400 transition-colors group-hover:border-red-400/30 group-hover:text-gray-200 sm:inline-flex">
        Ctrl K
      </kbd>
    </button>
  );
}
