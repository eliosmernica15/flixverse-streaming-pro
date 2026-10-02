"use client";

import { useEffect, useRef } from "react";
import { Keyboard } from "lucide-react";
import { PLAYER_SHORTCUTS } from "@/lib/player/keyboardShortcuts";

const GROUP_LABELS: Record<string, string> = {
  view: "View",
  playback: "Playback",
  party: "Watch together",
  server: "Servers",
};

interface PlayerShortcutsDropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function PlayerShortcutsDropdown({ open, onToggle, onClose }: PlayerShortcutsDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  const groups = ["view", "playback", "party", "server"] as const;

  return (
    <div ref={rootRef} className="player-shortcuts-dropdown">
      <button
        type="button"
        className={`player-window-btn ${open ? "is-active" : ""}`}
        onClick={onToggle}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Shortcuts (?)"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {open && (
        <div className="player-shortcuts-menu" role="menu" aria-label="Keyboard shortcuts">
          <div className="player-shortcuts-menu-head">
            <span>Keyboard shortcuts</span>
            <span className="player-shortcuts-menu-badge">?</span>
          </div>
          <p className="player-shortcuts-menu-note">
            Use the embed&apos;s built-in controls with your mouse. These keys layer on top.
          </p>
          {groups.map((group) => {
            const items = PLAYER_SHORTCUTS.filter((s) => s.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="player-shortcuts-group">
                <p className="player-shortcuts-group-label">{GROUP_LABELS[group]}</p>
                <ul>
                  {items.map(({ keys, action }) => (
                    <li key={action} className="player-shortcuts-menu-row">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
