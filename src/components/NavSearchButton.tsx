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
      className="group flex min-h-[40px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 text-gray-300 transition-colors duration-200 hover:border-red-500/40 hover:bg-white/10 hover:text-white focus-ring"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      {/* A keyboard hint is noise on touch devices, where there is no Ctrl key. */}
      <kbd className="hidden select-none rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-400 transition-colors group-hover:text-gray-200 sm:inline-flex">
        Ctrl K
      </kbd>
    </button>
  );
}
