export interface PlayerShortcut {
  keys: string[];
  action: string;
  group?: "view" | "playback" | "party" | "server";
}

export const PLAYER_SHORTCUTS: PlayerShortcut[] = [
  { keys: ["T"], action: "Enlarge video step-by-step (4 sizes)", group: "view" },
  { keys: ["F"], action: "Browser fullscreen", group: "view" },
  { keys: ["G"], action: "Open watch-together panel", group: "party" },
  { keys: ["V"], action: "Toggle party camera", group: "party" },
  { keys: ["P"], action: "Toggle party microphone", group: "party" },
  { keys: ["Esc"], action: "Exit fullscreen → restore → close", group: "view" },
  { keys: ["Space", "K"], action: "Play / pause", group: "playback" },
  { keys: ["←", "→"], action: "Seek ±10s (Shift: ±30s)", group: "playback" },
  { keys: ["↑", "↓"], action: "Volume (Shift: bigger step)", group: "playback" },
  { keys: ["+", "−"], action: "Volume up / down", group: "playback" },
  { keys: ["M"], action: "Mute / unmute", group: "playback" },
  { keys: ["N", "]"], action: "Next server", group: "server" },
  { keys: ["["], action: "Previous server", group: "server" },
  { keys: ["S"], action: "Server menu", group: "server" },
  { keys: ["L"], action: "Cycle audio language (English ↔ Albanian)", group: "server" },
  { keys: ["C"], action: "Comment at current time", group: "playback" },
  { keys: ["Shift+C"], action: "Toggle captions overlay", group: "playback" },
  { keys: ["0-9"], action: "Jump to 0–90%", group: "playback" },
  { keys: ["?"], action: "Keyboard shortcuts", group: "view" },
];
