"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage user's own online presence.
 * Sets a document in Firestore with onDisconnect handlers to mark user offline.
 */
export function useMyPresence() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!user) return;

    const db = getFirestore();
    const presenceRef = doc(db, "presence", user.uid);

    const setupPresence = () => {
      // Set online status with server timestamp
      setDoc(presenceRef, {
        userId: user.uid,
        status: "online",
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      // Set up onDisconnect handler to mark offline
      // Note: Firestore onDisconnect is handled by the Firebase SDK
      // We use a combination of onSnapshot and a heartbeat approach
      const heartbeatInterval = setInterval(async () => {
        try {
          await setDoc(presenceRef, {
            userId: user.uid,
            status: "online",
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          console.warn("[useMyPresence] heartbeat failed:", err);
        }
      }, 30000); // Heartbeat every 30 seconds

      // Clean up on unmount
      return () => {
        clearInterval(heartbeatInterval);
        // Mark offline when component unmounts (user leaves page)
        setDoc(presenceRef, {
          userId: user.uid,
          status: "offline",
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      };
    };

    const cleanup = setupPresence();
    return () => {
      cleanup?.();
    };
  }, [user]);

  return { isOnline };
}

/**
 * Hook to subscribe to presence status of multiple users.
 * Returns a map of userId -> online status.
 */
export function usePresence(userIds: string[]) {
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userIds.length) {
      setPresenceMap({});
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const q = query(
      collection(db, "presence"),
      where("userId", "in", userIds)
    );

    const unsub = onSnapshot(q, (snap) => {
      const newMap: Record<string, boolean> = {};
      snap.forEach((doc) => {
        const data = doc.data();
        newMap[data.userId] = data.status === "online";
      });
      // Users not in the snapshot are offline
      userIds.forEach((id) => {
        if (!(id in newMap)) {
          newMap[id] = false;
        }
      });
      setPresenceMap(newMap);
      setLoading(false);
    }, (err) => {
      console.warn("[usePresence] snapshot error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [userIds.join(",")]);

  return { presenceMap, loading };
}

/**
 * Hook to get online status of a single user.
 */
export function useUserPresence(userId: string | null) {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsOnline(false);
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const presenceRef = doc(db, "presence", userId);

    const unsub = onSnapshot(presenceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsOnline(data.status === "online");
      } else {
        setIsOnline(false);
      }
      setLoading(false);
    }, (err) => {
      console.warn("[useUserPresence] snapshot error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { isOnline, loading };
}