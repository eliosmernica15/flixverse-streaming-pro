/** Best-effort playback controls for cross-origin embed iframes. */

export type EmbedAction =
  | "play"
  | "pause"
  | "toggle"
  | "mute"
  | "unmute"
  | "setMute"
  | "setVolume"
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

export function sendEmbedAction(iframe: HTMLIFrameElement | null, action: EmbedAction, value?: number) {
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

    // ── Mute / Unmute (explicit state) ──
    case "mute":
      postAll(iframe, [
        { event: "command", func: "mute", args: "" },
        { method: "mute" },
        { action: "mute" },
        { type: "player:mute" },
      ]);
      return;
    case "unmute":
      postAll(iframe, [
        { event: "command", func: "unMute", args: "" },
        { event: "command", func: "unmute", args: "" },
        { method: "unmute" },
        { action: "unmute" },
        { type: "player:unmute" },
      ]);
      return;
    case "setMute":
      // value: 1 = mute, 0 = unmute
      if (value && value > 0) {
        sendEmbedAction(iframe, "mute");
      } else {
        sendEmbedAction(iframe, "unmute");
      }
      return;

    // ── Volume (explicit level) ──
    case "setVolume":
      // value: 0-100 volume level
      {
        const vol = Math.max(0, Math.min(100, value ?? 100));
        postAll(iframe, [
          { event: "command", func: "setVolume", args: [vol] },
          { event: "command", func: "volume", args: [vol] },
          { method: "setVolume", value: vol },
          { action: "setVolume", volume: vol },
          { type: "player:setVolume", volume: vol },
        ]);
        // Also handle mute/unmute based on volume
        if (vol === 0) {
          sendEmbedAction(iframe, "mute");
        } else {
          sendEmbedAction(iframe, "unmute");
        }
      }
      return;

    // ── Relative volume ──
    case "volumeUp":
      postAll(iframe, [
        { method: "volumeUp" },
        { action: "volumeUp" },
        { event: "command", func: "setVolume", args: ["100"] },
        { event: "command", func: "unMute", args: "" },
        { event: "command", func: "unmute", args: "" },
      ]);
      return;
    case "volumeDown":
      postAll(iframe, [
        { method: "volumeDown" },
        { action: "volumeDown" },
      ]);
      return;

    // ── Seek ──
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
    key === "]" ||
    key === "g" ||
    key === "G" ||
    key === "l" ||
    key === "L"
  );
}
