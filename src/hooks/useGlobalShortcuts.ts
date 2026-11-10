import { useEffect } from "react";
import { OPEN_SHORTCUTS_EVENT } from "@/components/KeyboardShortcutsHelp";

export const FOCUS_SEARCH_EVENT = "flixverse:focus-search";
export const OPEN_COMMAND_PALETTE_EVENT = "flixverse:open-command";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd+K is deliberately absent here: CommandPalette owns that
      // accelerator so it can *toggle*. Handling it in both places made one
      // keypress dispatch an open and then toggle the same state back, so the
      // palette never appeared.

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        // Announce to assistive tech that search is open.
        window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
        const live = document.querySelector('[aria-live="polite"]');
        if (live) (live as HTMLElement).textContent = "Search field focused";
        return;
      }

      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
