/** Clear party-related query params so the player does not auto-reopen or re-join. */
export function stripPartyQueryParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete("party");
  next.delete("autoplay");
  next.delete("server");
  next.delete("guest");
  return next;
}

export function partyLeftStorageKey(roomId: string): string {
  return `flixverse-left-party-${roomId}`;
}

export function markPartyLeft(roomId: string): void {
  try {
    sessionStorage.setItem(partyLeftStorageKey(roomId), "1");
  } catch {
    /* ignore */
  }
}

export function clearPartyLeftMark(roomId: string): void {
  try {
    sessionStorage.removeItem(partyLeftStorageKey(roomId));
  } catch {
    /* ignore */
  }
}

export function hasLeftParty(roomId: string): boolean {
  try {
    return sessionStorage.getItem(partyLeftStorageKey(roomId)) === "1";
  } catch {
    return false;
  }
}

export function replaceUrlWithoutPartyParams(): void {
  if (typeof window === "undefined") return;
  const params = stripPartyQueryParams(new URLSearchParams(window.location.search));
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(null, "", next);
}

export function stripGuestJoinParam(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("guest")) return;
  params.delete("guest");
  const qs = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}
