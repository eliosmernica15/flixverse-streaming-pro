"use client";

import { useEffect } from "react";

/**
 * Reference-counted body scroll lock.
 *
 * Multiple components (PlayerShell, MovieDetails, Navigation mobile menu)
 * may need to lock body scroll concurrently. A naive `body.style.overflow`
 * toggle races between them — the last one to unmount wins, leaving the
 * page locked.
 *
 * This hook uses a module-level counter so the lock is only released when
 * the last consumer unmounts.
 */
let lockCount = 0;
let savedBodyOverflow = "";
let savedHtmlOverflow = "";

function lockScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
  }
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}

/** Force-release the scroll lock. Use only for emergency recovery. */
export function forceReleaseBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  lockCount = 0;
  document.body.style.overflow = savedBodyOverflow;
  document.documentElement.style.overflow = savedHtmlOverflow;
}
