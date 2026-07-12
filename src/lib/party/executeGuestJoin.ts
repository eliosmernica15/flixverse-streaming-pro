import type { Notification } from "@/integrations/firebase/types";
import { acceptWatchPartyInvite } from "@/lib/notifications/partyInvite";
import {
  trackGuestJoinFailed,
  trackGuestJoinNavigated,
  trackGuestJoinStarted,
} from "@/lib/analytics";
import { fetchPartyRoomMeta } from "@/lib/player/roomEncryption";
import {
  joinPartyRoomApi,
  resolveGuestJoinTarget,
  partyMetaFromNotification,
} from "@/lib/party/guestJoin";
import {
  resetGuestJoinBridge,
  setGuestJoinBridge,
} from "@/lib/party/guestJoinBridge";
import { persistGuestJoinSession } from "@/lib/party/guestJoinSession";

const JOIN_RETRY_ATTEMPTS = 3;
const JOIN_RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefetchPath(path: string): void {
  if (typeof document === "undefined") return;
  const href = path.startsWith("http")
    ? path
    : `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;

  const existing = document.querySelector(`link[rel="prefetch"][href="${href}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  link.as = "document";
  document.head.appendChild(link);
}

async function joinRoomWithRetry(
  roomId: string,
  displayName: string,
  avatarUrl?: string | null
): Promise<boolean> {
  for (let attempt = 1; attempt <= JOIN_RETRY_ATTEMPTS; attempt++) {
    const ok = await joinPartyRoomApi(roomId, displayName, avatarUrl);
    if (ok) return true;
    if (attempt < JOIN_RETRY_ATTEMPTS) await delay(JOIN_RETRY_DELAY_MS * attempt);
  }
  return false;
}

export interface ExecuteGuestJoinParams {
  notification: Notification;
  user: { displayName?: string | null; photoURL?: string | null };
}

export async function executeGuestJoin({
  notification,
  user,
}: ExecuteGuestJoinParams): Promise<void> {
  const roomId = notification.data?.room_id;
  const movieTitle = notification.data?.movie_title;
  const hostName = notification.data?.from_user_name;

  setGuestJoinBridge({
    phase: "accepting",
    movieTitle,
    hostName,
    error: undefined,
  });

  trackGuestJoinStarted({
    roomId,
    source: "notification",
    movieTitle,
  });

  try {
    const meta = partyMetaFromNotification(notification);
    const prefetchMeta = roomId
      ? fetchPartyRoomMeta(roomId).catch(() => null)
      : Promise.resolve(null);

    setGuestJoinBridge({ phase: "accepting" });
    const [joinUrl] = await Promise.all([
      acceptWatchPartyInvite(notification),
      prefetchMeta,
    ]);

    if (roomId) {
      setGuestJoinBridge({ phase: "joining" });
      const joined = await joinRoomWithRetry(
        roomId,
        user.displayName || "Guest",
        user.photoURL
      );
      if (!joined) {
        throw new Error("Could not join the party room. It may have ended.");
      }
    }

    setGuestJoinBridge({ phase: "resolving" });
    const target = await resolveGuestJoinTarget(notification, joinUrl);

    setGuestJoinBridge({ phase: "prefetching" });
    prefetchPath(target);

    if (roomId) {
      persistGuestJoinSession({
        roomId,
        targetPath: target,
        movieTitle,
        hostName,
        startedAt: Date.now(),
      });
    }

    setGuestJoinBridge({ phase: "navigating" });
    trackGuestJoinNavigated({ roomId, target, hasMeta: !!meta });

    const href = target.startsWith("http")
      ? target
      : `${window.location.origin}${target.startsWith("/") ? target : `/${target}`}`;

    window.location.assign(href);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not join party";
    setGuestJoinBridge({ phase: "error", error: message });
    trackGuestJoinFailed({ roomId, reason: message });
    await delay(2200);
    resetGuestJoinBridge();
    throw err;
  }
}
