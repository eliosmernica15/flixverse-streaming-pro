import type { Notification } from "@/integrations/firebase/types";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { pythonFetch } from "@/lib/pythonApi/client";
import {
  buildPartyPlayerUrl,
  resolvePartyPlayerUrl,
  type PartyContentMeta,
} from "@/lib/player/roomEncryption";
import { clearPartyLeftMark } from "@/lib/player/partyUrl";

export function partyMetaFromNotification(notification: Notification): PartyContentMeta | null {
  const d = notification.data;
  const tmdbId = d?.content_id;
  if (!tmdbId) return null;
  return {
    tmdbId: Number(tmdbId),
    mediaType: (d?.content_type as "movie" | "tv") || "movie",
    season: typeof d?.season === "number" ? d.season : undefined,
    episode: typeof d?.episode === "number" ? d.episode : undefined,
    serverIndex: typeof d?.server_index === "number" ? d.server_index : 0,
  };
}

export function buildGuestPlayerUrl(roomId: string, meta: PartyContentMeta): string {
  const base = buildPartyPlayerUrl(roomId, meta, { autoplay: true });
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}guest=1`;
}

export async function joinPartyRoomApi(
  roomId: string,
  displayName: string,
  avatarUrl?: string | null
): Promise<boolean> {
  if (!isPythonBackendEnabled()) return true;
  try {
    await pythonFetch(`/parties/${roomId}/join`, {
      method: "POST",
      body: JSON.stringify({
        displayName,
        avatarUrl: avatarUrl ?? null,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveGuestJoinTarget(
  notification: Notification,
  fallbackJoinUrl?: string | null
): Promise<string> {
  const roomId = notification.data?.room_id;
  if (roomId) clearPartyLeftMark(roomId);

  const meta = partyMetaFromNotification(notification);
  if (roomId && meta) {
    return buildGuestPlayerUrl(roomId, meta);
  }

  if (roomId) {
    const resolved = await resolvePartyPlayerUrl(roomId, null);
    if (resolved) {
      return resolved.includes("?") ? `${resolved}&guest=1` : `${resolved}?guest=1`;
    }
    return `/party/join?id=${encodeURIComponent(roomId)}&guest=1`;
  }

  if (fallbackJoinUrl) {
    if (fallbackJoinUrl.startsWith("http")) {
      try {
        const u = new URL(fallbackJoinUrl);
        if (u.pathname.includes("/party/join")) {
          u.searchParams.set("guest", "1");
          return `${u.pathname}${u.search}${u.hash}`;
        }
      } catch {
        /* ignore */
      }
    }
    return fallbackJoinUrl;
  }

  return "/";
}

/** Join room via API, then hard-navigate to the synced player URL. */
export async function navigateGuestToParty(
  notification: Notification,
  joinUrl: string | null,
  user: { displayName?: string | null; photoURL?: string | null }
): Promise<string> {
  const roomId = notification.data?.room_id;
  if (roomId) {
    await joinPartyRoomApi(roomId, user.displayName || "Guest", user.photoURL);
  }
  const target = await resolveGuestJoinTarget(notification, joinUrl);
  const href = target.startsWith("http")
    ? target
    : `${window.location.origin}${target.startsWith("/") ? target : `/${target}`}`;
  window.location.assign(href);
  return href;
}
