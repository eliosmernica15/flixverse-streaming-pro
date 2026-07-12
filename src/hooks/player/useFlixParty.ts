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
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { trackPartyJoin } from "@/lib/analytics";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { useFlixPartyPython } from "@/hooks/player/useFlixPartyPython";
import type { PartyContentMeta } from "@/lib/player/roomEncryption";

function participantIds(participants: FlixPartyParticipant[]): string[] {
  return participants.map((p) => p.userId);
}

export interface FlixPartyParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: number;
  role: "host" | "guest";
  /** Host forced this guest's microphone off */
  micMutedByHost?: boolean;
  /** Host disabled this guest's camera */
  camDisabledByHost?: boolean;
}

export interface FlixPartyRoom {
  id: string;
  code: string;
  hostId: string;
  encryptedPayload: string;
  /** Public metadata for guest redirect without decryption key. */
  contentMeta?: PartyContentMeta | null;
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


export function useFlixParty(opts: UseFlixPartyOptions) {
  const pythonResult = useFlixPartyPython(opts);
  const firestoreResult = useFlixPartyFirestore(opts);
  return isPythonBackendEnabled() ? pythonResult : firestoreResult;
}

function useFlixPartyFirestore({ roomId }: UseFlixPartyOptions) {
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
        contentMeta: data.contentMeta ?? null,
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
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(40));

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
    async (encryptedPayload: string, contentMeta?: PartyContentMeta): Promise<string> => {
      if (!user) throw new Error("Must be signed in to create a party");

      const db = requireFirebaseDb();
      const code = generateCode();
      const roomId = crypto.randomUUID();
      const serverIndex = contentMeta?.serverIndex ?? 0;

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
        contentMeta: contentMeta ?? null,
        playbackState: "playing",
        lastKnownTime: 0,
        serverIndex,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        participants: [participant],
        participantIds: [user.uid],
      };

      await setDoc(doc(db, "flix_parties", roomId), roomData);
      return roomId;
    },
    [user, generateCode]
  );

  const joinRoomById = useCallback(
    async (targetRoomId: string): Promise<boolean> => {
      if (!user) return false;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", targetRoomId);
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return false;

      const data = snap.data();
      const participants: FlixPartyParticipant[] = data.participants || [];

      if (participants.find((p) => p.userId === user.uid)) {
        const updated = participants.map((p) =>
          p.userId === user.uid ? { ...p, lastSeenAt: Date.now() } : p
        );
        await updateDoc(roomRef, {
          participants: updated,
          participantIds: participantIds(updated),
          updatedAt: Date.now(),
        });
        return true;
      }

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

      await updateDoc(roomRef, {
        participants: [...participants, newParticipant],
        participantIds: participantIds([...participants, newParticipant]),
        updatedAt: Date.now(),
      });
      trackPartyJoin(targetRoomId);
      return true;
    },
    [user]
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

        const nextParticipants = [...participants, newParticipant];
        await updateDoc(doc(db, "flix_parties", roomDoc.id), {
          participants: nextParticipants,
          participantIds: participantIds(nextParticipants),
          updatedAt: Date.now(),
        });
      } else {
        // Update last seen
        const updated = participants.map((p) =>
          p.userId === user.uid ? { ...p, lastSeenAt: Date.now() } : p
        );
        await updateDoc(doc(db, "flix_parties", roomDoc.id), {
          participants: updated,
          participantIds: participantIds(updated),
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
      const isHostLeaving = data.hostId === user.uid;

      if (isHostLeaving) {
        await deleteDoc(roomRef);
      } else {
        const participants: FlixPartyParticipant[] = data.participants || [];
        const remaining = participants.filter((p) => p.userId !== user.uid);

        if (remaining.length === 0) {
          await deleteDoc(roomRef);
        } else {
          await updateDoc(roomRef, {
            participants: remaining,
            participantIds: participantIds(remaining),
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error("Error leaving room:", err);
    }
  }, [roomId, user]);

  const sendMessage = useCallback(
    async (text: string, emoji?: string) => {
      if (!roomId || !user) return;
      if (isRateLimited("PARTY_CHAT", user.uid)) {
        throw new Error("Slow down — too many messages");
      }

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
    async (state: "playing" | "paused", currentTime: number, serverIndex?: number) => {
      if (!roomId) return;

      const db = requireFirebaseDb();
      const patch: Record<string, unknown> = {
        playbackState: state,
        lastKnownTime: currentTime,
        updatedAt: Date.now(),
      };
      if (typeof serverIndex === "number") {
        patch.serverIndex = serverIndex;
      }
      await updateDoc(doc(db, "flix_parties", roomId), patch);
    },
    [roomId]
  );

  const kickParticipant = useCallback(
    async (targetUserId: string) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;
      if (targetUserId === user.uid) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return;

      const data = snap.data();
      const participants: FlixPartyParticipant[] = data.participants || [];
      const remaining = participants.filter((p) => p.userId !== targetUserId);
      if (remaining.length === participants.length) return;

      await updateDoc(roomRef, {
        participants: remaining,
        participantIds: participantIds(remaining),
        updatedAt: Date.now(),
      });
    },
    [roomId, user, room?.hostId]
  );

  const setParticipantMicMuted = useCallback(
    async (targetUserId: string, muted: boolean) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return;

      const participants: FlixPartyParticipant[] = snap.data().participants || [];
      const updated = participants.map((p) =>
        p.userId === targetUserId ? { ...p, micMutedByHost: muted } : p
      );

      await updateDoc(roomRef, {
        participants: updated,
        updatedAt: Date.now(),
      });
    },
    [roomId, user, room?.hostId]
  );

  const setParticipantCamDisabled = useCallback(
    async (targetUserId: string, disabled: boolean) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return;

      const participants: FlixPartyParticipant[] = snap.data().participants || [];
      const updated = participants.map((p) =>
        p.userId === targetUserId ? { ...p, camDisabledByHost: disabled } : p
      );

      await updateDoc(roomRef, {
        participants: updated,
        updatedAt: Date.now(),
      });
    },
    [roomId, user, room?.hostId]
  );

  const isHost = room?.hostId === user?.uid;

  return {
    room,
    messages,
    loading,
    isHost,
    createRoom,
    joinRoom,
    joinRoomById,
    leaveRoom,
    sendMessage,
    updatePlaybackState,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
  };
}
