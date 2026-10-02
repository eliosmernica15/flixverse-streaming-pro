import type { Notification } from "@/integrations/firebase/types";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { pythonFetch } from "@/lib/pythonApi/client";
import { doc, updateDoc } from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { sendNotificationToUser } from "@/lib/notifications/createNotification";

export function buildWatchPartyInviteId(roomId: string, toUserId: string) {
  return `${roomId}_${toUserId}`;
}

export async function acceptWatchPartyInvite(notification: Notification): Promise<string | null> {
  if (isPythonBackendEnabled()) {
    const data = await pythonFetch<{ ok: boolean; joinUrl?: string }>(
      "/notifications/party-invite/accept",
      {
        method: "POST",
        body: JSON.stringify({ notificationId: notification.id }),
      }
    );
    return data.joinUrl ?? notification.data?.party_join_url ?? null;
  }

  const db = requireFirebaseDb();
  const joinUrl = notification.data?.party_join_url ?? null;
  const roomId = notification.data?.room_id;
  const inviteId =
    notification.data?.invite_id ??
    (roomId && notification.user_id ? buildWatchPartyInviteId(roomId, notification.user_id) : null);

  if (inviteId) {
    await updateDoc(doc(db, "watch_party_invites", inviteId), {
      status: "accepted",
      respondedAt: Date.now(),
    });
  }

  await updateDoc(doc(db, "notifications", notification.id), {
    read: true,
    data: { ...notification.data, invite_status: "accepted" },
  });

  return joinUrl;
}

export async function declineWatchPartyInvite(
  notification: Notification,
  responderId: string,
  responderName: string
): Promise<void> {
  if (isPythonBackendEnabled()) {
    await pythonFetch("/notifications/party-invite/decline", {
      method: "POST",
      body: JSON.stringify({ notificationId: notification.id }),
    });
    return;
  }

  const db = requireFirebaseDb();
  const roomId = notification.data?.room_id;
  const inviteId =
    notification.data?.invite_id ??
    (roomId ? buildWatchPartyInviteId(roomId, responderId) : null);
  const hostId = notification.from_user_id ?? notification.data?.from_user_id;

  if (inviteId) {
    await updateDoc(doc(db, "watch_party_invites", inviteId), {
      status: "declined",
      respondedAt: Date.now(),
    });
  }

  await updateDoc(doc(db, "notifications", notification.id), {
    read: true,
    data: { ...notification.data, invite_status: "declined" },
  });

  if (hostId && hostId !== responderId) {
    const movieTitle = notification.data?.movie_title || "your watch party";
    await sendNotificationToUser({
      recipientId: hostId,
      senderId: responderId,
      senderName: responderName,
      type: "watch_party_invite_declined",
      title: "Invite declined",
      message: `${responderName} declined your invite to watch "${movieTitle}"`,
      data: {
        room_id: roomId,
        movie_title: notification.data?.movie_title,
        from_user_id: responderId,
        from_user_name: responderName,
      },
    });
  }
}
