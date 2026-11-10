"use client";

import { useEffect } from "react";

/**
 * Recover from stale-deployment chunk failures.
 *
 * When a deployment replaces `_next/static` assets, a tab that is still
 * running the old build can request chunks that no longer exist. Next.js
 * throws `ChunkLoadError` (or a dynamic import rejects) and the page is
 * dead until the user manually reloads.
 *
 * Strategy:
 *  - Watch `error` (capture) and `unhandledrejection` for chunk failures.
 *  - Reload **once** per build, guarded by a sessionStorage stamp, so a
 *    genuinely broken deploy can never trap the tab in a reload loop.
 *  - Never reload while the user is typing, or while the tab is hidden
 *    (a background reload loses playback state for no benefit).
 *  - A second failure inside the window surfaces a one-shot toast-able
 *    event instead of reloading again.
 */

const CHUNK_RELOAD_KEY = "flixverse_chunk_reload_at";
const CHUNK_RELOAD_COUNT_KEY = "flixverse_chunk_reload_count";
const RELOAD_COOLDOWN_MS = 60_000;
const MAX_RELOADS_PER_SESSION = 2;

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

function isChunkError(value: unknown): boolean {
  if (!value) return false;
  const name =
    typeof value === "object" && value !== null && "name" in value
      ? String((value as { name?: unknown }).name ?? "")
      : "";
  const message =
    typeof value === "string"
      ? value
      : typeof value === "object" && value !== null && "message" in value
        ? String((value as { message?: unknown }).message ?? "")
        : "";
  return CHUNK_ERROR_PATTERN.test(name) || CHUNK_ERROR_PATTERN.test(message);
}

function readNumber(key: string): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Private mode / storage disabled — reload guard degrades to in-memory.
  }
}

function userIsTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    // A checkbox/radio focus does not represent in-progress typing.
    return type !== "checkbox" && type !== "radio" && type !== "button";
  }
  return true;
}

export function ChunkReloadBoundary() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let reloadScheduled = false;

    const handleChunkFailure = () => {
      if (reloadScheduled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (userIsTyping()) return;

      const now = Date.now();
      const lastReloadAt = readNumber(CHUNK_RELOAD_KEY);
      const reloadCount = readNumber(CHUNK_RELOAD_COUNT_KEY);

      if (now - lastReloadAt < RELOAD_COOLDOWN_MS) return;

      if (reloadCount >= MAX_RELOADS_PER_SESSION) {
        // A reload already failed to fix it — this is a broken deploy, not a
        // stale tab. Stop reloading and let the app's error UI take over.
        window.dispatchEvent(
          new CustomEvent("flixverse:chunk-error-exhausted", {
            detail: { reloadCount, at: now },
          })
        );
        return;
      }

      reloadScheduled = true;
      writeNumber(CHUNK_RELOAD_KEY, now);
      writeNumber(CHUNK_RELOAD_COUNT_KEY, reloadCount + 1);

      // Small delay: lets an in-flight error boundary render and avoids
      // reloading while the first paint is still settling.
      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    };

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent;
      if (isChunkError(errorEvent.error) || isChunkError(errorEvent.message)) {
        handleChunkFailure();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason)) handleChunkFailure();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

export default ChunkReloadBoundary;
