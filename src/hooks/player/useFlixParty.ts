import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FlixPartyParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: number;
  role: "host" | "guest";
}

export interface FlixPartyRoom {
  id: string;
  code: string;
  hostId: string;
  encryptedPayload: string;
  playbackState: "playing" | "paused";
  lastKnownTime: number;
  serverIndex: number;
  updatedAt: number;
  participants: FlixPartyParticipant[];
  createdAt: number;
}

export interface FlixPartyChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  emoji?: string;
  createdAt: number;
}

interface UseFlixPartyOptions {
  roomId: string | null;
}

export function useFlixParty({ roomId }: UseFlixPartyOptions) {
  const { user } = useAuth();
  const [room, setRoom] = useState<FlixPartyRoom | null>(null);
  const [messages, setMessages] = useState<FlixPartyChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  // Subscribe to room document
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = requireFirebaseDb();
    const roomRef = doc(db, "flix_parties", roomId);

    const unsub = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        setLoading(false);
        return;
      }

      const data = snap.data();
      setRoom({
        id: snap.id,
        code: data.code,
        hostId: data.hostId,
        encryptedPayload: data.encryptedPayload,
        playbackState: data.playbackState,
        lastKnownTime: data.lastKnownTime,
        serverIndex: data.serverIndex,
        updatedAt: data.updatedAt,
        participants: data.participants || [],
        createdAt: data.createdAt,
      });
      setLoading(false);
    }, (err) => {
      console.error("FlixParty room snapshot error:", err);
      setLoading(false);
    });

    unsubscribeRef.current.push(unsub);
    return () => {
      unsub();
      unsubscribeRef.current = unsubscribeRef.current.filter((u) => u !== unsub);
    };
  }, [roomId]);

  // Subscribe to chat messages subcollection
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      return;
    }

    const db = requireFirebaseDb();
    const messagesRef = collection(db, "flix_parties", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs: FlixPartyChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data();
        msgs.push({
          id: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          text: data.text,
          emoji: data.emoji,
          createdAt: data.createdAt,
        });
      });
      setMessages(msgs.reverse());
    });

    unsubscribeRef.current.push(unsub);
    return () => {
      unsub();
      unsubscribeRef.current = unsubscribeRef.current.filter((u) => u !== unsub);
    };
  }, [roomId]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current.forEach((u) => u());
      unsubscribeRef.current = [];
    };
  }, []);

  const generateCode = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }, []);

  const createRoom = useCallback(
    async (encryptedPayload: string): Promise<string> => {
      if (!user) throw new Error("Must be signed in to create a party");

      const db = requireFirebaseDb();
      const code = generateCode();
      const roomId = crypto.randomUUID();

      const participant: FlixPartyParticipant = {
        userId: user.uid,
        displayName: user.displayName || "Host",
        avatarUrl: user.photoURL,
        lastSeenAt: Date.now(),
        role: "host",
      };

      const roomData = {
        code,
        hostId: user.uid,
        encryptedPayload,
        playbackState: "playing",
        lastKnownTime: 0,
        serverIndex: 0,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        participants: [participant],
      };

      await setDoc(doc(db, "flix_parties", roomId), roomData);
      return roomId;
    },
    [user, generateCode]
  );

  const joinRoom = useCallback(
    async (roomCode: string): Promise<string | null> => {
      if (!user) throw new Error("Must be signed in to join a party");

      const db = requireFirebaseDb();
      const roomsRef = collection(db, "flix_parties");
      const q = query(roomsRef, where("code", "==", roomCode.toUpperCase()), limit(1));

      const snap = await import("firebase/firestore").then((m) => m.getDocs(q));
      if (snap.empty) return null;

      const roomDoc = snap.docs[0];
      if (!roomDoc) return null;

      const data = roomDoc.data();
      const participants: FlixPartyParticipant[] = data.participants || [];

      // Check if already in room
      const existing = participants.find((p) => p.userId === user.uid);
      if (!existing) {
        // Max 20 participants
        if (participants.length >= 20) {
          throw new Error("Room is full (max 20 participants)");
        }

        const newParticipant: FlixPartyParticipant = {
          userId: user.uid,
          displayName: user.displayName || "Guest",
          avatarUrl: user.photoURL,
          lastSeenAt: Date.now(),
          role: "guest",
        };

        await updateDoc(doc(db, "flix_parties", roomDoc.id), {
          participants: [...participants, newParticipant],
          updatedAt: Date.now(),
        });
      } else {
        // Update last seen
        const updated = participants.map((p) =>
          p.userId === user.uid ? { ...p, lastSeenAt: Date.now() } : p
        );
        await updateDoc(doc(db, "flix_parties", roomDoc.id), {
          participants: updated,
          updatedAt: Date.now(),
        });
      }

      return roomDoc.id;
    },
    [user]
  );

  const leaveRoom = useCallback(async () => {
    if (!roomId || !user) return;

    const db = requireFirebaseDb();
    const roomRef = doc(db, "flix_parties", roomId);

    try {
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return;

      const data = snap.data();
      const participants: FlixPartyParticipant[] = data.participants || [];
      const remaining = participants.filter((p) => p.userId !== user.uid);

      if (remaining.length === 0) {
        // Last person left — delete room
        await deleteDoc(roomRef);
      } else {
        // Promote next guest to host if host left
        const newHostId =
          data.hostId === user.uid ? remaining[0].userId : data.hostId;
        const updatedParticipants = remaining.map((p) => ({
          ...p,
          role: (p.userId === newHostId ? "host" : "guest") as "host" | "guest",
        }));

        await updateDoc(roomRef, {
          participants: updatedParticipants,
          hostId: newHostId,
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error("Error leaving room:", err);
    }
  }, [roomId, user]);

  const sendMessage = useCallback(
    async (text: string, emoji?: string) => {
      if (!roomId || !user) return;

      const db = requireFirebaseDb();
      const messagesRef = collection(db, "flix_parties", roomId, "messages");

      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: user.displayName || "Guest",
        senderAvatar: user.photoURL,
        text,
        emoji: emoji || null,
        createdAt: Date.now(),
      });
    },
    [roomId, user]
  );

  const updatePlaybackState = useCallback(
    async (state: "playing" | "paused", currentTime: number) => {
      if (!roomId) return;

      const db = requireFirebaseDb();
      await updateDoc(doc(db, "flix_parties", roomId), {
        playbackState: state,
        lastKnownTime: currentTime,
        updatedAt: Date.now(),
      });
    },
    [roomId]
  );

  const isHost = room?.hostId === user?.uid;

  return {
    room,
    messages,
    loading,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    updatePlaybackState,
  };
}
