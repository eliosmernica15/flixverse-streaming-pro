/**
 * Player embed controls.
 *
 * Strategy: focus the iframe → dispatch keyboard events (these penetrate
 * cross-origin iframes) → also send postMessage as fallback for providers
 * that expose an API. Keyboard is primary because it works universally.
 */

export type EmbedAction =
  | "play"
  | "pause"
  | "toggle"
  | "mute"
  | "unmute"
  | "seekForward"
  | "seekBack"
  | "volumeUp"
  | "volumeDown";

// ── Low-level helpers ──

function focusIframe(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  iframe.focus({ preventScroll: true });
}

/** Send a keyboard event into the focused iframe. */
function pressKey(iframe: HTMLIFrameElement | null, key: string, code?: string) {
  if (!iframe) return;
  focusIframe(iframe);
  const win = iframe.contentWindow;
  if (!win) return;

  const opts: KeyboardEventInit = {
    key,
    code: code || key,
    bubbles: true,
    cancelable: true,
  };

  try {
    win.dispatchEvent(new KeyboardEvent("keydown", opts));
    win.dispatchEvent(new KeyboardEvent("keyup", opts));
  } catch {
    // cross-origin — may fail silently
  }

  // Also dispatch on the iframe element itself for some providers
  try {
    iframe.dispatchEvent(new KeyboardEvent("keydown", opts));
  } catch {}
}

/** PostMessage with every known provider format. */
function postMessage(iframe: HTMLIFrameElement | null, payloads: unknown[]) {
  const win = iframe?.contentWindow;
  if (!win) return;
  for (const payload of payloads) {
    try {
      win.postMessage(
        typeof payload === "string" ? payload : JSON.stringify(payload),
        "*"
      );
    } catch {}
  }
}

// ── Public API ──

export function sendEmbedAction(
  iframe: HTMLIFrameElement | null,
  action: EmbedAction
) {
  if (!iframe) return;

  switch (action) {
    // ── Play / Pause ──
    // Most players treat Space as play/pause toggle. Some use K.
    // YouTube API also accepts postMessage.
    case "toggle":
      pressKey(iframe, " ");
      postMessage(iframe, [
        { event: "command", func: "playVideo" },
        { event: "command", func: "pauseVideo" },
        { method: "togglePlay" },
        { type: "toggle" },
        { action: "toggle" },
      ]);
      return;

    case "play":
      pressKey(iframe, " ");
      postMessage(iframe, [
        { event: "command", func: "playVideo" },
        { method: "play" },
        { action: "play" },
        { type: "play" },
      ]);
      return;

    case "pause":
      pressKey(iframe, " ");
      postMessage(iframe, [
        { event: "command", func: "pauseVideo" },
        { method: "pause" },
        { action: "pause" },
        { type: "pause" },
      ]);
      return;

    // ── Mute ──
    // M key is universal for mute toggle.
    case "mute":
    case "unmute":
      pressKey(iframe, "m", "KeyM");
      postMessage(iframe, [
        { event: "command", func: "mute" },
        { method: "mute" },
        { action: "mute" },
        { type: "mute" },
      ]);
      return;

    // ── Seek ──
    // Arrow keys are universal for seeking in most players.
    case "seekForward":
      pressKey(iframe, "ArrowRight", "ArrowRight");
      postMessage(iframe, [
        { event: "command", func: "seek", args: [10] },
        { method: "seek", value: 10 },
        { action: "seek", seconds: 10 },
        { type: "seek", direction: "forward" },
      ]);
      return;

    case "seekBack":
      pressKey(iframe, "ArrowLeft", "ArrowLeft");
      postMessage(iframe, [
        { event: "command", func: "seek", args: [-10] },
        { method: "seek", value: -10 },
        { action: "seek", seconds: -10 },
        { type: "seek", direction: "back" },
      ]);
      return;

    // ── Volume ──
    // ArrowUp/ArrowDown control volume in most players.
    case "volumeUp":
      pressKey(iframe, "ArrowUp", "ArrowUp");
      postMessage(iframe, [
        { method: "volumeUp" },
        { action: "volumeUp" },
      ]);
      return;

    case "volumeDown":
      pressKey(iframe, "ArrowDown", "ArrowDown");
      postMessage(iframe, [
        { method: "volumeDown" },
        { action: "volumeDown" },
      ]);
      return;
  }
}

export function isPlayerShortcutKey(key: string) {
  return (
    key === " " ||
    key === "k" || key === "K" ||
    key === "f" || key === "F" ||
    key === "m" || key === "M" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  );
}
