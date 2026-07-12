import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { pythonFetch } from "@/lib/pythonApi/client";
import { sendNotificationToUser } from "@/lib/notifications/createNotification";
import { buildWatchPartyInviteId } from "@/lib/notifications/partyInvite";
import { doc, setDoc } from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";

export interface WatchPartyInvitePayload {
  roomId: string;
  roomTitle: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  movieId?: number | null;
  mediaType?: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  posterPath?: string | null;
  partyJoinUrl: string;
}

export async function sendWatchPartyInvite(payload: WatchPartyInvitePayload): Promise<boolean> {
  if (isPythonBackendEnabled()) {
    try {
      await pythonFetch("/invites", {
        method: "POST",
        body: JSON.stringify({
          roomId: payload.roomId,
          toUserId: payload.toUserId,
          toUserName: payload.toUserName,
          partyJoinUrl: payload.partyJoinUrl,
          roomTitle: payload.roomTitle,
          movieId: payload.movieId,
          mediaType: payload.mediaType,
          season: payload.season,
          episode: payload.episode,
          posterPath: payload.posterPath,
        }),
      });
      return true;
    } catch (err) {
      console.error("[party-invite/python] failed:", err);
      return false;
    }
  }

  const db = requireFirebaseDb();
  const inviteId = buildWatchPartyInviteId(payload.roomId, payload.toUserId);

  await setDoc(doc(db, "watch_party_invites", inviteId), {
    roomId: payload.roomId,
    roomTitle: payload.roomTitle,
    fromUserId: payload.fromUserId,
    fromUserName: payload.fromUserName,
    toUserId: payload.toUserId,
    toUserName: payload.toUserName,
    movieId: payload.movieId ?? null,
    mediaType: payload.mediaType ?? "movie",
    season: payload.season ?? null,
    episode: payload.episode ?? null,
    posterPath: payload.posterPath ?? null,
    partyJoinUrl: payload.partyJoinUrl,
    status: "pending",
    createdAt: Date.now(),
  });

  return sendNotificationToUser({
    recipientId: payload.toUserId,
    senderId: payload.fromUserId,
    senderName: payload.fromUserName,
    type: "watch_party_invite",
    title: "Watch party invite",
    message: `${payload.fromUserName} invited you to watch "${payload.roomTitle}" together`,
    data: {
      invite_id: inviteId,
      invite_status: "pending",
      party_join_url: payload.partyJoinUrl,
      room_id: payload.roomId,
      content_id: payload.movieId ?? undefined,
      content_type: payload.mediaType ?? "movie",
      movie_title: payload.roomTitle,
    },
  });
}
