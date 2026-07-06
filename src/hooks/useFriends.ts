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
  orderBy,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

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
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to friends list
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const friendsRef = collection(db, "friendships");
    const q = query(
      friendsRef,
      where("status", "==", "accepted"),
      where("users", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: Friend[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // The friend is the OTHER user in the pair
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

  // Subscribe to incoming friend requests
  useEffect(() => {
    if (!user) {
      setIncomingRequests([]);
      return;
    }

    const db = getFirestore();
    const requestsRef = collection(db, "friend_requests");
    const q = query(
      requestsRef,
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

  // Search users by display name
  const searchUsers = useCallback(async (searchQuery: string): Promise<UserProfile[]> => {
    if (!user || searchQuery.length < 2) return [];

    const db = getFirestore();
    const profilesRef = collection(db, "profiles");
    const searchTerm = searchQuery.toLowerCase();

    // Get all profiles and filter client-side (Firestore doesn't support partial string matching)
    const snap = await getDocs(query(profilesRef, limit(50)));
    const results: UserProfile[] = [];

    snap.forEach((d) => {
      const data = d.data();
      if (d.id !== user.uid && data.display_name?.toLowerCase().includes(searchTerm)) {
        results.push({
          uid: d.id,
          displayName: data.display_name,
          photoURL: data.avatar_url || null,
        });
      }
    });

    return results.slice(0, 10);
  }, [user]);

  // Send friend request
  const sendFriendRequest = useCallback(async (targetUser: UserProfile) => {
    if (!user) return;

    const db = getFirestore();

    // Check if already friends or request exists
    const existingQ = query(
      collection(db, "friendships"),
      where("users", "array-contains", user.uid)
    );
    const existingSnap = await getDocs(existingQ);
    for (const d of existingSnap.docs) {
      const data = d.data();
      if (data.users.includes(targetUser.uid)) return; // Already friends
    }

    // Check for existing pending request
    const requestsQ = query(
      collection(db, "friend_requests"),
      where("fromUserId", "==", user.uid),
      where("toUserId", "==", targetUser.uid),
      where("status", "==", "pending")
    );
    const requestsSnap = await getDocs(requestsQ);
    if (!requestsSnap.empty) return; // Already sent

    await addDoc(collection(db, "friend_requests"), {
      fromUserId: user.uid,
      fromDisplayName: user.displayName || "Unknown",
      fromAvatarUrl: user.photoURL || null,
      toUserId: targetUser.uid,
      status: "pending",
      createdAt: Date.now(),
    });
  }, [user]);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (request: FriendRequest) => {
    if (!user) return;

    const db = getFirestore();

    // Create friendship document
    await addDoc(collection(db, "friendships"), {
      users: [user.uid, request.fromUserId],
      displayNames: {
        [user.uid]: user.displayName || "Unknown",
        [request.fromUserId]: request.fromDisplayName,
      },
      avatarUrls: {
        [user.uid]: user.photoURL || null,
        [request.fromUserId]: request.fromAvatarUrl || null,
      },
      status: "accepted",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update request status
    await deleteDoc(doc(db, "friend_requests", request.id));
  }, [user]);

  // Decline friend request
  const declineFriendRequest = useCallback(async (request: FriendRequest) => {
    const db = getFirestore();
    await deleteDoc(doc(db, "friend_requests", request.id));
  }, []);

  // Remove friend
  const removeFriend = useCallback(async (friendshipId: string) => {
    const db = getFirestore();
    await deleteDoc(doc(db, "friendships", friendshipId));
  }, []);

  // Check if two users are friends
  const areFriends = useCallback((userId1: string, userId2: string): boolean => {
    return friends.some(
      (f) =>
        (f.userId === userId1 && userId2 === user?.uid) ||
        (f.userId === userId2 && userId1 === user?.uid)
    );
  }, [friends, user]);

  return {
    friends,
    incomingRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    areFriends,
  };
}
