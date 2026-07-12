"use client";

import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["T"], action: "Maximize / restore player" },
  { keys: ["F"], action: "Browser fullscreen" },
  { keys: ["Esc"], action: "Exit fullscreen → restore → close" },
  { keys: ["Space", "K"], action: "Play / pause" },
  { keys: ["←", "→"], action: "Seek ±10s (Shift: ±30s)" },
  { keys: ["↑", "↓"], action: "Volume up / down (Shift: bigger step)" },
  { keys: ["+", "−"], action: "Volume up / down" },
  { keys: ["M"], action: "Mute / unmute" },
  { keys: ["N", "]"], action: "Next server" },
  { keys: ["["], action: "Previous server" },
  { keys: ["0-9"], action: "Jump to 0–90%" },
  { keys: ["?"], action: "Show this help" },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div className="player-shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button type="button" className="player-shortcuts-backdrop" onClick={onClose} aria-label="Close" />
      <div className="player-shortcuts-panel">
        <div className="player-shortcuts-head">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-white text-sm">Keyboard shortcuts</h2>
          </div>
          <button type="button" onClick={onClose} className="player-shortcuts-close" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="player-shortcuts-note">
          The embed has its own on-screen controls. These keys layer on top for quick actions.
        </p>
        <ul className="player-shortcuts-list">
          {SHORTCUTS.map(({ keys, action }) => (
            <li key={action} className="player-shortcuts-row">
              <span>{action}</span>
              <span className="player-shortcuts-keys">
                {keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
