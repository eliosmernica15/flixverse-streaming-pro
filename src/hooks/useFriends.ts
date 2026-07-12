import { useState, useEffect, useCallback } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { sendNotificationToUser } from "@/lib/notifications/createNotification";

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

export type FriendRelationship = "friend" | "incoming" | "outgoing" | "none";

export type SendFriendResult =
  | "sent"
  | "accepted"
  | "already_friends"
  | "already_sent"
  | "error";

export function useFriends() {
  const { user } = useAuth();
  const { profile } = useUserProfileContext();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const myName =
    profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "Unknown";
  const myAvatar = profile?.avatar_url || user?.photoURL || null;

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const q = query(
      collection(db, "friendships"),
      where("status", "==", "accepted"),
      where("users", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: Friend[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const friendId = data.users.find((u: string) => u !== user.uid);
        if (friendId) {
          items.push({
            id: d.id,
            userId: friendId,
            displayName: data.displayNames?.[friendId] || "Unknown",
            avatarUrl: data.avatarUrls?.[friendId] || null,
            addedAt: data.updatedAt || Date.now(),
          });
        }
      });
      setFriends(items.sort((a, b) => b.addedAt - a.addedAt));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIncomingRequests([]);
      return;
    }

    const db = getFirestore();
    const q = query(
      collection(db, "friend_requests"),
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: FriendRequest[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as FriendRequest);
      });
      setIncomingRequests(items);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOutgoingRequests([]);
      return;
    }

    const db = getFirestore();
    const q = query(
      collection(db, "friend_requests"),
      where("fromUserId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: FriendRequest[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as FriendRequest);
      });
      setOutgoingRequests(items);
    });

    return () => unsub();
  }, [user]);

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

  const searchUsers = useCallback(async (searchQuery: string): Promise<UserProfile[]> => {
    if (!user || searchQuery.length < 2) return [];

    try {
      const headers = await import("@/lib/firebase/clientAuth").then((m) =>
        m.getAuthHeaders(user)
      );
      const res = await fetch(`/api/profile/username?q=${encodeURIComponent(searchQuery)}`, {
        headers,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results: Array<{
            uid: string;
            username: string;
            displayName: string;
            photoURL: string | null;
          }>;
        };
        return data.results.map((r) => ({
          uid: r.uid,
          displayName: r.displayName,
          photoURL: r.photoURL,
          username: r.username,
        }));
      }
    } catch {
      // fall through
    }

    const db = getFirestore();
    const searchTerm = searchQuery.toLowerCase().trim();
    const results: UserProfile[] = [];
    const seen = new Set<string>();

    const profilesSnap = await getDocs(query(collection(db, "profiles"), limit(80)));
    profilesSnap.forEach((d) => {
      const data = d.data();
      const name = (data.display_name as string) || "";
      const handle = (data.username as string) || "";
      if (
        name.toLowerCase().includes(searchTerm) ||
        handle.toLowerCase().includes(searchTerm)
      ) {
        if (d.id !== user.uid && !seen.has(d.id)) {
          seen.add(d.id);
          results.push({
            uid: d.id,
            displayName: name || handle,
            photoURL: data.avatar_url || null,
            username: handle || null,
          });
        }
      }
    });

    return results.slice(0, 12);
  }, [user]);

  const acceptFriendRequest = useCallback(
    async (request: FriendRequest) => {
      if (!user) return;

      const db = getFirestore();

      await addDoc(collection(db, "friendships"), {
        users: [user.uid, request.fromUserId],
        displayNames: {
          [user.uid]: myName,
          [request.fromUserId]: request.fromDisplayName,
        },
        avatarUrls: {
          [user.uid]: myAvatar,
          [request.fromUserId]: request.fromAvatarUrl || null,
        },
        status: "accepted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await deleteDoc(doc(db, "friend_requests", request.id));

        await sendNotificationToUser({
          recipientId: request.fromUserId,
          senderId: user.uid,
          senderName: myName,
          type: "friend_accepted",
          title: "Friend request accepted",
          message: `${myName} accepted your friend request`,
          data: { from_user_id: user.uid, from_user_name: myName },
        });
    },
    [user, myName, myAvatar]
  );

  const sendFriendRequest = useCallback(
    async (targetUser: UserProfile): Promise<SendFriendResult> => {
      if (!user) return "error";

      try {
        const db = getFirestore();

        if (friends.some((f) => f.userId === targetUser.uid)) {
          return "already_friends";
        }

        const incoming = incomingRequests.find((r) => r.fromUserId === targetUser.uid);
        if (incoming) {
          await acceptFriendRequest(incoming);
          return "accepted";
        }

        const outgoing = outgoingRequests.find((r) => r.toUserId === targetUser.uid);
        if (outgoing) {
          return "already_sent";
        }

        const requestsQ = query(
          collection(db, "friend_requests"),
          where("fromUserId", "==", user.uid),
          where("toUserId", "==", targetUser.uid),
          where("status", "==", "pending")
        );
        const requestsSnap = await getDocs(requestsQ);
        if (!requestsSnap.empty) return "already_sent";

        const docRef = await addDoc(collection(db, "friend_requests"), {
          fromUserId: user.uid,
          fromDisplayName: myName,
          fromAvatarUrl: myAvatar,
          toUserId: targetUser.uid,
          status: "pending",
          createdAt: Date.now(),
        });

        await sendNotificationToUser({
          recipientId: targetUser.uid,
          senderId: user.uid,
          senderName: myName,
          type: "friend_request",
          title: "New friend request",
          message: `${myName} wants to be your friend`,
          data: {
            from_user_id: user.uid,
            from_user_name: myName,
            friend_request_id: docRef.id,
          },
        });

        return "sent";
      } catch {
        return "error";
      }
    },
    [user, myName, myAvatar, friends, incomingRequests, outgoingRequests, acceptFriendRequest]
  );

  const declineFriendRequest = useCallback(async (request: FriendRequest) => {
    const db = getFirestore();
    await deleteDoc(doc(db, "friend_requests", request.id));
  }, []);

  const removeFriend = useCallback(async (friendshipId: string) => {
    const db = getFirestore();
    await deleteDoc(doc(db, "friendships", friendshipId));
  }, []);

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
