/** Restore document scroll after the fullscreen player closes. */
export function releasePageScrollLock(): void {
  if (typeof document === "undefined") return;
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  document.body.style.pointerEvents = "";
}
