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
import { dedupeRoomParticipants } from "@/lib/party/participantUtils";
import { useFlixPartyPython } from "@/hooks/player/useFlixPartyPython";
import type { PartyContentMeta } from "@/lib/player/roomEncryption";

/**
 * Throttle interval for host heartbeat (ms).
 * Only the host writes playback state; guests only read.
 * 5s balances sync accuracy with Firestore write costs.
 */
const HEARTBEAT_INTERVAL_MS = 5000;

/**
 * NOTE: React.memo should be applied to the consuming components
 * (chat, camera grid, HUD) that use this hook's returned data,
 * not to the hook itself. This hook returns stable references via
 * useCallback/useMemo so child components can benefit from memoization.
 */

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

export interface FlixPartyQueueItem {
  id: string;
  /** TMDB ID of the suggested content */
  tmdbId: number;
  /** Media type: movie or tv */
  mediaType: "movie" | "tv";
  /** Season number (for TV) */
  season?: number;
  /** Episode number (for TV) */
  episode?: number;
  /** Title of the content */
  title: string;
  /** Poster path */
  posterPath?: string | null;
  /** Server index for streaming */
  serverIndex?: number;
  /** User who suggested this item */
  suggestedBy: string;
  /** Display name of suggester */
  suggestedByName: string;
  /** Avatar of suggester */
  suggestedByAvatar?: string | null;
  /** Unix timestamp when suggested */
  suggestedAt: number;
  /** Array of user IDs who voted for this item */
  votes: string[];
  /** Total vote count */
  voteCount: number;
  /** Whether the host has confirmed/selected this item */
  confirmed?: boolean;
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
  /** Who may drive playback. Defaults to HOST_ONLY. */
  controlsMode?: "HOST_ONLY" | "COLLABORATIVE";
  /** Pending queue of content suggestions with votes */
  pendingQueue?: FlixPartyQueueItem[];
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
  const lastHeartbeatRef = useRef<number>(0);

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
      const hostId = data.hostId as string;
      setRoom({
        id: snap.id,
        code: data.code,
        hostId,
        encryptedPayload: data.encryptedPayload,
        contentMeta: data.contentMeta ?? null,
        playbackState: data.playbackState,
        lastKnownTime: data.lastKnownTime,
        serverIndex: data.serverIndex,
        updatedAt: data.updatedAt,
        participants: dedupeRoomParticipants(data.participants || [], hostId),
        createdAt: data.createdAt,
        // Previously dropped here, so the host's Collaborative toggle was
        // written to the doc but every client kept reading HOST_ONLY.
        controlsMode: data.controlsMode === "COLLABORATIVE" ? "COLLABORATIVE" : "HOST_ONLY",
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

  // Subscribe to pending queue
  const [pendingQueue, setPendingQueue] = useState<FlixPartyQueueItem[]>([]);

  useEffect(() => {
    if (!roomId) {
      setPendingQueue([]);
      return;
    }

    const db = requireFirebaseDb();
    const roomRef = doc(db, "flix_parties", roomId);

    const unsub = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        setPendingQueue([]);
        return;
      }
      const data = snap.data();
      const queue = (data.pendingQueue || []) as FlixPartyQueueItem[];
      // Sort by vote count descending, then by suggestedAt ascending
      const sorted = [...queue].sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.suggestedAt - b.suggestedAt;
      });
      setPendingQueue(sorted);
    }, (err) => {
      console.error("FlixParty queue snapshot error:", err);
    });

    unsubscribeRef.current.push(unsub);
    return () => {
      unsub();
      unsubscribeRef.current = unsubscribeRef.current.filter((u) => u !== unsub);
    };
  }, [roomId]);

  // Cleanup all subscriptions on unmount.
  // Each subscription above also has its own cleanup in the effect return,
  // ensuring proper unsubscription when roomId changes or component unmounts.
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
        controlsMode: "HOST_ONLY",
      };

      await setDoc(doc(db, "flix_parties", roomId), roomData);
      return roomId;
    },
    [user, generateCode]
  );

  /**
   * Add (or refresh) the signed-in user in a room.
   *
   * The join is a read-modify-write on a single `participants` array. Two
   * people joining at the same instant — the normal case when an invite link
   * is posted to a group chat — would each read the pre-join array and the
   * second write would silently drop the first guest. `runTransaction`
   * serialises the read and write on the server so both land.
   */
  const joinRoomById = useCallback(
    async (targetRoomId: string): Promise<boolean> => {
      if (!user) return false;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", targetRoomId);
      const firestore = await import("firebase/firestore");

      let joined = false;
      let alreadyMember = false;

      await firestore.runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const participants: FlixPartyParticipant[] = data.participants || [];
        const existingIdx = participants.findIndex((p) => p.userId === user.uid);

        if (existingIdx >= 0) {
          alreadyMember = true;
          const refreshed = participants.slice();
          refreshed[existingIdx] = { ...refreshed[existingIdx], lastSeenAt: Date.now() };
          tx.update(roomRef, {
            participants: refreshed,
            participantIds: participantIds(refreshed),
            updatedAt: Date.now(),
          });
          joined = true;
          return;
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
        const next = [...participants, newParticipant];
        tx.update(roomRef, {
          participants: next,
          participantIds: participantIds(next),
          updatedAt: Date.now(),
        });
        joined = true;
      });

      if (joined && !alreadyMember) trackPartyJoin(targetRoomId);
      return joined;
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
      if (!roomId || !user) return;

      // Only the host writes playback state to Firestore.
      // Throttle to HEARTBEAT_INTERVAL_MS to avoid excessive writes on every timeupdate.
      const isHost = room?.hostId === user.uid;
      if (!isHost) return;

      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;

      // If this is a play/pause state change (not just a time update), write immediately
      // Otherwise, throttle to heartbeat interval
      const isStateChange = room && room.playbackState !== state;
      if (!isStateChange && timeSinceLastHeartbeat < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      lastHeartbeatRef.current = now;

      const db = requireFirebaseDb();
      const patch: Record<string, unknown> = {
        playbackState: state,
        lastKnownTime: currentTime,
        updatedAt: now,
      };
      if (typeof serverIndex === "number") {
        patch.serverIndex = serverIndex;
      }
      await updateDoc(doc(db, "flix_parties", roomId), patch);
    },
    [roomId, user, room]
  );

  const updateEncryptedPayload = useCallback(
    async (encryptedPayload: string) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;
      await updateDoc(doc(requireFirebaseDb(), "flix_parties", roomId), {
        encryptedPayload,
        updatedAt: Date.now(),
      });
    },
    [roomId, user, room?.hostId]
  );

  const setControlsMode = useCallback(
    async (mode: "HOST_ONLY" | "COLLABORATIVE") => {
      if (!roomId || !user || room?.hostId !== user.uid) return;
      const db = requireFirebaseDb();
      await updateDoc(doc(db, "flix_parties", roomId), {
        controlsMode: mode,
        updatedAt: Date.now(),
      });
    },
    [roomId, user, room?.hostId]
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

  /**
   * Pass the Crown — hand host authority to another participant.
   *
   * Rewrites `hostId` and the `role` field of both participants in one
   * update so there is never a moment with zero or two hosts.
   *
   * Sequence continuity: guests drop any event whose `seq` is not above
   * their cursor, and that cursor advances on heartbeats too — but the
   * persisted `hostSeq` only advances on play/pause/seek. Seeding the new
   * host from it would make guests discard the new host's events as stale
   * for up to the 15 s epoch gap. Jumping the persisted mark to the current
   * wall-clock in ms guarantees it exceeds every seq sent so far (events are
   * rate-limited far below one per millisecond), so the new host's first
   * event is accepted immediately.
   */
  const transferHost = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!roomId || !user || room?.hostId !== user.uid || targetUserId === user.uid) return false;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);
      const snap = await import("firebase/firestore").then((m) => m.getDoc(roomRef));
      if (!snap.exists()) return false;

      const data = snap.data();
      if (data.hostId !== user.uid) return false;
      const participants: FlixPartyParticipant[] = data.participants || [];
      if (!participants.some((p) => p.userId === targetUserId)) return false;

      const updated = participants.map((p) => {
        if (p.userId === targetUserId) {
          // The new host is never left muted/blocked by the old host.
          return { ...p, role: "host" as const, micMutedByHost: false, camDisabledByHost: false };
        }
        if (p.userId === user.uid) return { ...p, role: "guest" as const };
        return p;
      });

      await updateDoc(roomRef, {
        hostId: targetUserId,
        participants: updated,
        participantIds: participantIds(updated),
        hostSeq: Math.max((typeof data.hostSeq === "number" ? data.hostSeq : 0) + 1, Date.now()),
        hostSeqAt: Date.now(),
        updatedAt: Date.now(),
      });
      return true;
    },
    [roomId, user, room?.hostId]
  );

  /**
   * Suggest a new item to the party queue.
   * Any participant can suggest content.
   */
  const suggestToQueue = useCallback(
    async (
      item: Omit<FlixPartyQueueItem, "id" | "votes" | "voteCount" | "suggestedAt" | "suggestedBy" | "suggestedByName" | "suggestedByAvatar">
    ) => {
      if (!roomId || !user) return;
      if (isRateLimited("PARTY_QUEUE_SUGGEST", user.uid)) {
        throw new Error("Too many suggestions — please wait a moment");
      }

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);

      const newItem: FlixPartyQueueItem = {
        ...item,
        id: crypto.randomUUID(),
        suggestedBy: user.uid,
        suggestedByName: user.displayName || "Guest",
        suggestedByAvatar: user.photoURL,
        suggestedAt: Date.now(),
        votes: [user.uid], // Auto-vote for your own suggestion
        voteCount: 1,
      };

      await import("firebase/firestore").then((firestore) =>
        firestore.runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");

          const data = snap.data();
          const currentQueue: FlixPartyQueueItem[] = data.pendingQueue || [];

          // Limit queue to 20 items
          if (currentQueue.length >= 20) {
            throw new Error("Queue is full (max 20 items)");
          }

          // Check if user already suggested this exact content
          const duplicate = currentQueue.find(
            (q) => q.tmdbId === item.tmdbId && q.mediaType === item.mediaType && q.season === item.season && q.episode === item.episode
          );
          if (duplicate) {
            throw new Error("This content is already in the queue");
          }

          tx.update(roomRef, {
            pendingQueue: [...currentQueue, newItem],
            updatedAt: Date.now(),
          });
        })
      );
    },
    [roomId, user]
  );

  /**
   * Vote for a queue item.
   * Any participant can vote. Vote is toggled (add if not voted, remove if already voted).
   */
  const voteQueueItem = useCallback(
    async (itemId: string) => {
      if (!roomId || !user) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);

      await import("firebase/firestore").then((firestore) =>
        firestore.runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");

          const data = snap.data();
          const currentQueue: FlixPartyQueueItem[] = data.pendingQueue || [];
          const itemIndex = currentQueue.findIndex((q) => q.id === itemId);
          if (itemIndex === -1) throw new Error("Queue item not found");

          const item = currentQueue[itemIndex];
          const hasVoted = item.votes.includes(user.uid);

          let updatedItem: FlixPartyQueueItem;
          if (hasVoted) {
            // Remove vote
            updatedItem = {
              ...item,
              votes: item.votes.filter((v) => v !== user.uid),
              voteCount: Math.max(0, item.voteCount - 1),
            };
          } else {
            // Add vote
            updatedItem = {
              ...item,
              votes: [...item.votes, user.uid],
              voteCount: item.voteCount + 1,
            };
          }

          const updatedQueue = [...currentQueue];
          updatedQueue[itemIndex] = updatedItem;

          tx.update(roomRef, {
            pendingQueue: updatedQueue,
            updatedAt: Date.now(),
          });
        })
      );
    },
    [roomId, user]
  );

  /**
   * Host confirms a queue item as the next content to play.
   * This broadcasts the selection to all guests.
   */
  const confirmQueueItem = useCallback(
    async (itemId: string) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);

      await import("firebase/firestore").then((firestore) =>
        firestore.runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");

          const data = snap.data();
          const currentQueue: FlixPartyQueueItem[] = data.pendingQueue || [];
          const itemIndex = currentQueue.findIndex((q) => q.id === itemId);
          if (itemIndex === -1) throw new Error("Queue item not found");

          const item = currentQueue[itemIndex];
          const updatedItem = { ...item, confirmed: true };
          const updatedQueue = [...currentQueue];
          updatedQueue[itemIndex] = updatedItem;

          // Also update the room's contentMeta and encryptedPayload for the new content
          const newContentMeta: PartyContentMeta = {
            tmdbId: item.tmdbId,
            mediaType: item.mediaType,
            season: item.season,
            episode: item.episode,
            serverIndex: item.serverIndex ?? data.serverIndex ?? 0,
          };

          // Create encrypted payload for the new content
          // The room key is not available here, so we only update contentMeta
          // The actual encrypted payload update happens on the host's client
          tx.update(roomRef, {
            pendingQueue: updatedQueue,
            contentMeta: newContentMeta,
            serverIndex: newContentMeta.serverIndex,
            updatedAt: Date.now(),
          });
        })
      );
    },
    [roomId, user, room?.hostId]
  );

  /**
   * Host removes an item from the queue.
   */
  const removeQueueItem = useCallback(
    async (itemId: string) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);

      await import("firebase/firestore").then((firestore) =>
        firestore.runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");

          const data = snap.data();
          const currentQueue: FlixPartyQueueItem[] = data.pendingQueue || [];
          const updatedQueue = currentQueue.filter((q) => q.id !== itemId);

          tx.update(roomRef, {
            pendingQueue: updatedQueue,
            updatedAt: Date.now(),
          });
        })
      );
    },
    [roomId, user, room?.hostId]
  );

  /**
   * Guest removes their own suggestion from the queue.
   */
  const removeOwnQueueItem = useCallback(
    async (itemId: string) => {
      if (!roomId || !user) return;

      const db = requireFirebaseDb();
      const roomRef = doc(db, "flix_parties", roomId);

      await import("firebase/firestore").then((firestore) =>
        firestore.runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");

          const data = snap.data();
          const currentQueue: FlixPartyQueueItem[] = data.pendingQueue || [];
          const item = currentQueue.find((q) => q.id === itemId);
          if (!item) throw new Error("Queue item not found");
          if (item.suggestedBy !== user.uid) throw new Error("Can only remove your own suggestions");

          const updatedQueue = currentQueue.filter((q) => q.id !== itemId);

          tx.update(roomRef, {
            pendingQueue: updatedQueue,
            updatedAt: Date.now(),
          });
        })
      );
    },
    [roomId, user]
  );

  const isHost = room?.hostId === user?.uid;

  return {
    room,
    messages,
    loading,
    isHost,
    pendingQueue,
    createRoom,
    joinRoom,
    joinRoomById,
    leaveRoom,
    sendMessage,
    updatePlaybackState,
    updateEncryptedPayload,
    setControlsMode,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
    transferHost: transferHost as ((targetUserId: string) => Promise<boolean>) | null,
    suggestToQueue,
    voteQueueItem,
    confirmQueueItem,
    removeQueueItem,
    removeOwnQueueItem,
  };
}
