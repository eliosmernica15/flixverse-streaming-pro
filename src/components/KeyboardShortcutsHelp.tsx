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
    group: "Player — playback",
    items: [
      { keys: ["P"], label: "Play / pause" },
      { keys: ["Space"], label: "Play / pause" },
      { keys: ["K"], label: "Play / pause" },
      { keys: ["←"], label: "Seek back 10s" },
      { keys: ["→"], label: "Seek forward 10s" },
      { keys: ["↑"], label: "Volume up" },
      { keys: ["↓"], label: "Volume down" },
      { keys: ["M"], label: "Mute" },
      { keys: ["R"], label: "Reload stream" },
    ],
  },
  {
    group: "Player — display & servers",
    items: [
      { keys: ["F"], label: "Theater + fullscreen" },
      { keys: ["T"], label: "Theater + fullscreen" },
      { keys: ["C"], label: "Cinematic bars" },
      { keys: ["["], label: "Previous server" },
      { keys: ["]"], label: "Next server" },
      { keys: ["N"], label: "Next server" },
      { keys: ["S"], label: "Server menu" },
      { keys: ["Esc"], label: "Exit fullscreen / close" },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="chip inline-flex min-w-[1.75rem] justify-center px-2 py-1 font-semibold text-gray-200">
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
      <DialogContent className="glass-strong max-w-lg animate-scale-in rounded-2xl border border-white/10 text-white shadow-2xl shadow-black/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/15">
              <Keyboard className="h-5 w-5 text-red-500" />
            </span>
            <span className="eyebrow !text-white/90">Keyboard shortcuts</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Power-user controls across FlixVerse. Shortcuts are disabled while typing in inputs.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          {shortcuts.map((section) => (
            <div key={section.group}>
              <h3 className="eyebrow mb-3 text-red-400/90">{section.group}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/5 py-2 pl-3 pr-2 transition-colors hover:bg-white/5"
                  >
                    <span className="text-sm text-gray-300">{item.label}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.keys.map((key, i) => (
                        <span key={`${item.label}-${key}`} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-xs text-gray-600">/</span>}
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
