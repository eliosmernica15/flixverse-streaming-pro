/** Best-effort playback controls for cross-origin embed iframes. */

export type EmbedAction =
  | "play"
  | "pause"
  | "toggle"
  | "mute"
  | "seekForward"
  | "seekBack"
  | "volumeUp"
  | "volumeDown";

export function focusEmbed(iframe: HTMLIFrameElement | null) {
  iframe?.focus({ preventScroll: true });
}

export function clickEmbedCenter(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  iframe.focus({ preventScroll: true });
  const rect = iframe.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  };
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"] as const) {
    iframe.dispatchEvent(new MouseEvent(type, opts));
  }
}

function postAll(iframe: HTMLIFrameElement | null, payloads: unknown[]) {
  const win = iframe?.contentWindow;
  if (!win) return;
  for (const payload of payloads) {
    try {
      win.postMessage(typeof payload === "string" ? payload : JSON.stringify(payload), "*");
    } catch {
      // cross-origin postMessage failures are ignored
    }
  }
}

export function sendEmbedAction(iframe: HTMLIFrameElement | null, action: EmbedAction) {
  if (!iframe) return;

  switch (action) {
    case "toggle":
      clickEmbedCenter(iframe);
      postAll(iframe, [
        { event: "command", func: "pauseVideo", args: "" },
        { event: "command", func: "playVideo", args: "" },
        { method: "togglePlay" },
        { type: "toggle" },
      ]);
      return;
    case "play":
      focusEmbed(iframe);
      postAll(iframe, [
        { event: "command", func: "playVideo", args: "" },
        { method: "play" },
        { action: "play" },
        { type: "player:play" },
        "play",
      ]);
      clickEmbedCenter(iframe);
      return;
    case "pause":
      focusEmbed(iframe);
      postAll(iframe, [
        { event: "command", func: "pauseVideo", args: "" },
        { method: "pause" },
        { action: "pause" },
        { type: "player:pause" },
        "pause",
      ]);
      clickEmbedCenter(iframe);
      return;
    case "mute":
      postAll(iframe, [
        { event: "command", func: "mute", args: "" },
        { method: "mute" },
        { action: "mute" },
        { type: "player:mute" },
      ]);
      return;
    case "seekForward":
      postAll(iframe, [
        { event: "command", func: "seek", args: [10] },
        { method: "seek", value: 10 },
        { action: "seek", seconds: 10 },
        { type: "seek", direction: "forward", amount: 10 },
      ]);
      clickEmbedCenter(iframe);
      return;
    case "seekBack":
      postAll(iframe, [
        { event: "command", func: "seek", args: [-10] },
        { method: "seek", value: -10 },
        { action: "seek", seconds: -10 },
        { type: "seek", direction: "back", amount: 10 },
      ]);
      clickEmbedCenter(iframe);
      return;
    case "volumeUp":
      postAll(iframe, [{ method: "volumeUp" }, { action: "volumeUp" }]);
      return;
    case "volumeDown":
      postAll(iframe, [{ method: "volumeDown" }, { action: "volumeDown" }]);
      return;
  }
}

export function isPlayerShortcutKey(key: string) {
  return (
    key === " " ||
    key === "p" ||
    key === "P" ||
    key === "k" ||
    key === "K" ||
    key === "f" ||
    key === "F" ||
    key === "m" ||
    key === "M" ||
    key === "r" ||
    key === "R" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "[" ||
    key === "]"
  );
}
