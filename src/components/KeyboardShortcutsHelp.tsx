"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

export const OPEN_SHORTCUTS_EVENT = "flixverse:open-shortcuts";

const shortcuts = [
  {
    group: "Global",
    items: [
      { keys: ["/"], label: "Focus search" },
      { keys: ["Ctrl", "K"], label: "Command palette" },
      { keys: ["?"], label: "Keyboard shortcuts" },
      { keys: ["Esc"], label: "Close dialogs / modals" },
    ],
  },
  {
    group: "Player",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: ["F"], label: "Fullscreen" },
      { keys: ["M"], label: "Mute" },
      { keys: ["T"], label: "Theater mode" },
      { keys: ["C"], label: "Cinematic bars" },
      { keys: ["N"], label: "Next server" },
      { keys: ["S"], label: "Server list" },
      { keys: ["←", "→"], label: "Seek 10s" },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-gray-200 shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="w-5 h-5 text-red-500" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Power-user controls across FlixVerse. Shortcuts are disabled while typing in inputs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((section) => (
            <div key={section.group}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {section.group}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0"
                  >
                    <span className="text-sm text-gray-300">{item.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.keys.map((key, i) => (
                        <span key={`${item.label}-${key}`} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-gray-600 text-xs">+</span>}
                          <KeyBadge>{key}</KeyBadge>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
