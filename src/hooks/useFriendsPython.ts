/**
 * Friends / friend requests backed by the Python Postgres API.
 * The Python side stores friendships as a sorted (user_a, user_b) pair and
 * friend requests by id "fromUid_toUid"; this hook exposes the same
 * shape as useFirestoreFriends to keep call sites stable.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { sendNotificationToUser } from "@/lib/notifications/createNotification";

const POLL_MS = 25000;

export type FriendRelationship = "friend" | "incoming" | "outgoing" | "none";
export type SendFriendResult = "sent" | "accepted" | "already_friends" | "already_sent" | "error";

export interface Friend {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  username?: string | null;
}

export function usePythonFriends() {
  const { user } = useAuth();
  const { profile } = useUserProfileContext();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const myName =
    profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "Unknown";
  const myAvatar = profile?.avatar_url || user?.photoURL || null;

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [friendIds, reqs] = await Promise.all([
        pythonFetch<{ userIds: string[] }>(`/social/friends/${encodeURIComponent(user.uid)}`),
        pythonFetch<{ requests: { id: string; from_user_id: string; to_user_id: string; created_at: number }[] }>(
          "/social/friend-requests"
        ),
      ]);
      const ids = friendIds.userIds || [];
      setFriends(
        ids.map((id) => ({
          id: `${id}`,
          userId: id,
          displayName: id, // backend doesn't return display names yet
          avatarUrl: null,
          addedAt: Date.now(),
        }))
      );
      setIncomingRequests(
        (reqs.requests || [])
          .filter((r) => r.to_user_id === user.uid)
          .map((r) => ({
            id: r.id,
            fromUserId: r.from_user_id,
            fromDisplayName: r.from_user_id,
            fromAvatarUrl: null,
            toUserId: r.to_user_id,
            status: "pending",
            createdAt: r.created_at,
          }))
      );
      setOutgoingRequests(
        (reqs.requests || [])
          .filter((r) => r.from_user_id === user.uid)
          .map((r) => ({
            id: r.id,
            fromUserId: r.from_user_id,
            fromDisplayName: myName,
            fromAvatarUrl: myAvatar,
            toUserId: r.to_user_id,
            status: "pending",
            createdAt: r.created_at,
          }))
      );
    } catch (err) {
      console.error("[friends/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, myName, myAvatar]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setFriends([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [user, refresh]);

  const getRelationship = useCallback(
    (targetUid: string): FriendRelationship => {
      if (!user || targetUid === user.uid) return "none";
      if (friends.some((f) => f.userId === targetUid)) return "friend";
      if (incomingRequests.some((r) => r.fromUserId === targetUid)) return "incoming";
      if (outgoingRequests.some((r) => r.toUserId === targetUid)) return "outgoing";
      return "none";
    },
    [user, friends, incomingRequests, outgoingRequests]
  );

  const searchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
    if (!user || query.length < 2) return [];
    // No full-text search yet; resolve a username if it looks like one.
    if (query.startsWith("@") || /^[a-z0-9_]+$/i.test(query)) {
      const handle = query.startsWith("@") ? query.slice(1).toLowerCase() : query.toLowerCase();
      try {
        const data = await pythonFetch<{ uid: string; displayName: string }>(
          `/profile/username/${encodeURIComponent(handle)}`
        );
        if (data.uid && data.uid !== user.uid) {
          return [
            { uid: data.uid, displayName: data.displayName || handle, photoURL: null, username: handle },
          ];
        }
      } catch {
        // ignore
      }
    }
    return [];
  }, [user]);

  const acceptFriendRequest = useCallback(
    async (request: FriendRequest) => {
      if (!user) return;
      try {
        await pythonFetch(
          `/social/friend-request/${encodeURIComponent(request.id)}/accept`,
          { method: "POST" }
        );
        await sendNotificationToUser({
          recipientId: request.fromUserId,
          senderId: user.uid,
          senderName: myName,
          type: "friend_accepted",
          title: "Friend request accepted",
          message: `${myName} accepted your friend request`,
          data: { from_user_id: user.uid, from_user_name: myName },
        });
        void refresh();
      } catch (err) {
        console.error("[friends/python] accept failed:", err);
      }
    },
    [user, myName, refresh]
  );

  const sendFriendRequest = useCallback(
    async (targetUser: UserProfile): Promise<SendFriendResult> => {
      if (!user) return "error";
      if (friends.some((f) => f.userId === targetUser.uid)) return "already_friends";
      const incoming = incomingRequests.find((r) => r.fromUserId === targetUser.uid);
      if (incoming) {
        await acceptFriendRequest(incoming);
        return "accepted";
      }
      if (outgoingRequests.some((r) => r.toUserId === targetUser.uid)) return "already_sent";

      try {
        await pythonFetch("/social/friend-request", {
          method: "POST",
          body: JSON.stringify({ toUserId: targetUser.uid }),
        });
        await sendNotificationToUser({
          recipientId: targetUser.uid,
          senderId: user.uid,
          senderName: myName,
          type: "friend_request",
          title: "New friend request",
          message: `${myName} wants to be your friend`,
          data: { from_user_id: user.uid, from_user_name: myName },
        });
        void refresh();
        return "sent";
      } catch (err) {
        console.error("[friends/python] send failed:", err);
        return "error";
      }
    },
    [user, myName, friends, incomingRequests, outgoingRequests, acceptFriendRequest, refresh]
  );

  const declineFriendRequest = useCallback(
    async (request: FriendRequest) => {
      try {
        await pythonFetch(
          `/social/friend-request/${encodeURIComponent(request.id)}/decline`,
          { method: "POST" }
        );
        void refresh();
      } catch (err) {
        console.error("[friends/python] decline failed:", err);
      }
    },
    [refresh]
  );

  const removeFriend = useCallback(
    async (_friendshipId: string) => {
      // Not exposed in the Python API yet; nothing to do.
      void refresh();
    },
    [refresh]
  );

  const areFriends = useCallback(
    (userId1: string, userId2: string): boolean => {
      return friends.some(
        (f) =>
          (f.userId === userId1 && userId2 === user?.uid) ||
          (f.userId === userId2 && userId1 === user?.uid)
      );
    },
    [friends, user]
  );

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    areFriends,
    getRelationship,
  };
}
