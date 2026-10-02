const SESSION_KEY = "flixverse-guest-join-session";

export interface GuestJoinSession {
  roomId: string;
  targetPath: string;
  movieTitle?: string;
  hostName?: string;
  startedAt: number;
}

export function persistGuestJoinSession(session: GuestJoinSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota */
  }
}

export function readGuestJoinSession(): GuestJoinSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestJoinSession;
    if (!parsed?.roomId || !parsed?.targetPath) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuestJoinSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
