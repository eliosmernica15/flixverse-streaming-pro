"use client";

import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["Space", "K"], action: "Play / Pause" },
  { keys: ["←", "→"], action: "Seek backward / forward 10s" },
  { keys: ["↑", "↓"], action: "Volume up / down" },
  { keys: ["M"], action: "Mute / unmute" },
  { keys: ["F", "T"], action: "Toggle fullscreen" },
  { keys: ["C"], action: "Toggle cinematic mode" },
  { keys: ["S"], action: "Open server selector" },
  { keys: ["N", "]"], action: "Next server" },
  { keys: ["["], action: "Previous server" },
  { keys: ["R"], action: "Reload stream" },
  { keys: ["I"], action: "Skip intro" },
  { keys: ["G"], action: "Toggle FlixParty" },
  { keys: ["L"], action: "Toggle timeline comments" },
  { keys: ["Esc"], action: "Close player / exit fullscreen" },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-white text-sm">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-1">
            {SHORTCUTS.map(({ keys, action }) => (
              <div
                key={action}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="text-sm text-gray-300">{action}</span>
                <div className="flex items-center gap-1">
                  {keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-[1.75rem] h-6 px-1.5 flex items-center justify-center rounded-md bg-white/10 border border-white/10 text-[11px] font-semibold text-white"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
