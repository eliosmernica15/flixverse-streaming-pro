import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { trackPartyJoin } from "@/lib/analytics";
import { pythonFetch } from "@/lib/pythonApi/client";
import type {
  FlixPartyChatMessage,
  FlixPartyParticipant,
  FlixPartyRoom,
} from "@/hooks/player/useFlixParty";

interface UseFlixPartyOptions {
  roomId: string | null;
}

const ROOM_POLL_MS = 1200;
const MESSAGE_POLL_MS = 2500;

export function useFlixPartyPython({ roomId }: UseFlixPartyOptions) {
  const { user } = useAuth();
  const [room, setRoom] = useState<FlixPartyRoom | null>(null);
  const [messages, setMessages] = useState<FlixPartyChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const roomPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await pythonFetch<{ room: FlixPartyRoom }>(`/parties/${roomId}`);
      setRoom(data.room);
      return data.room;
    } catch {
      setRoom(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const fetchMessages = useCallback(async () => {
    if (!roomId) {
      setMessages([]);
      return;
    }
    try {
      const data = await pythonFetch<{ messages: FlixPartyChatMessage[] }>(
        `/parties/${roomId}/messages`
      );
      setMessages(data.messages);
    } catch {
      setMessages([]);
    }
  }, [roomId]);

  useEffect(() => {
    void fetchRoom();
    void fetchMessages();
    if (!roomId) return;

    roomPollRef.current = setInterval(() => void fetchRoom(), ROOM_POLL_MS);
    msgPollRef.current = setInterval(() => void fetchMessages(), MESSAGE_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchRoom();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (roomPollRef.current) clearInterval(roomPollRef.current);
      if (msgPollRef.current) clearInterval(msgPollRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, fetchRoom, fetchMessages]);

  const createRoom = useCallback(
    async (encryptedPayload: string): Promise<string> => {
      if (!user) throw new Error("Must be signed in");
      const data = await pythonFetch<{ roomId: string; room: FlixPartyRoom }>("/parties", {
        method: "POST",
        body: JSON.stringify({
          encryptedPayload,
          hostName: user.displayName || "Host",
          hostAvatar: user.photoURL,
        }),
      });
      setRoom(data.room);
      return data.roomId;
    },
    [user]
  );

  const joinRoomById = useCallback(
    async (targetRoomId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const data = await pythonFetch<{ ok: boolean; room: FlixPartyRoom }>(
          `/parties/${targetRoomId}/join`,
          {
            method: "POST",
            body: JSON.stringify({
              displayName: user.displayName || "Guest",
              avatarUrl: user.photoURL,
            }),
          }
        );
        setRoom(data.room);
        trackPartyJoin(targetRoomId);
        return true;
      } catch {
        return false;
      }
    },
    [user]
  );

  const joinRoom = useCallback(
    async (code: string): Promise<string | null> => {
      if (!user) return null;
      try {
        const data = await pythonFetch<{ roomId: string; room: FlixPartyRoom }>(
          "/parties/join-by-code",
          {
            method: "POST",
            body: JSON.stringify({
              code: code.trim().toUpperCase(),
              displayName: user.displayName || "Guest",
              avatarUrl: user.photoURL,
            }),
          }
        );
        setRoom(data.room);
        trackPartyJoin(data.roomId);
        return data.roomId;
      } catch {
        return null;
      }
    },
    [user]
  );

  const leaveRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      await pythonFetch(`/parties/${roomId}/leave`, { method: "POST" });
    } catch {
      /* ignore */
    }
    setRoom(null);
    setMessages([]);
  }, [roomId]);

  const sendMessage = useCallback(
    async (text: string, emoji?: string) => {
      if (!roomId || !user) return;
      if (isRateLimited("PARTY_CHAT", user.uid)) {
        throw new Error("Slow down — too many messages");
      }
      const data = await pythonFetch<{ message: FlixPartyChatMessage }>(
        `/parties/${roomId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ text, emoji }),
        }
      );
      setMessages((prev) => [...prev, data.message]);
    },
    [roomId, user]
  );

  const updatePlaybackState = useCallback(
    async (state: "playing" | "paused", currentTime: number) => {
      if (!roomId) return;
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              playbackState: state,
              lastKnownTime: currentTime,
              updatedAt: Date.now(),
            }
          : prev
      );
      try {
        await pythonFetch(`/parties/${roomId}/playback`, {
          method: "PATCH",
          body: JSON.stringify({ state, currentTime }),
        });
      } catch {
        /* host-only */
      }
    },
    [roomId]
  );

  const kickParticipant = useCallback(
    async (targetUserId: string) => {
      if (!roomId || !user || room?.hostId !== user.uid || targetUserId === user.uid) return;

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.filter((p) => p.userId !== targetUserId),
            }
          : prev
      );

      try {
        const data = await pythonFetch<{ room: FlixPartyRoom }>(
          `/parties/${roomId}/participants/${targetUserId}`,
          { method: "DELETE" }
        );
        setRoom(data.room);
      } catch {
        void fetchRoom();
      }
    },
    [roomId, user, room?.hostId, fetchRoom]
  );

  const setParticipantMicMuted = useCallback(
    async (targetUserId: string, muted: boolean) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.userId === targetUserId ? { ...p, micMutedByHost: muted } : p
              ),
            }
          : prev
      );

      try {
        const data = await pythonFetch<{ room: FlixPartyRoom }>(
          `/parties/${roomId}/participants/${targetUserId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ micMutedByHost: muted }),
          }
        );
        setRoom(data.room);
      } catch {
        void fetchRoom();
      }
    },
    [roomId, user, room?.hostId, fetchRoom]
  );

  const setParticipantCamDisabled = useCallback(
    async (targetUserId: string, disabled: boolean) => {
      if (!roomId || !user || room?.hostId !== user.uid) return;

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.userId === targetUserId ? { ...p, camDisabledByHost: disabled } : p
              ),
            }
          : prev
      );

      try {
        const data = await pythonFetch<{ room: FlixPartyRoom }>(
          `/parties/${roomId}/participants/${targetUserId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ camDisabledByHost: disabled }),
          }
        );
        setRoom(data.room);
      } catch {
        void fetchRoom();
      }
    },
    [roomId, user, room?.hostId, fetchRoom]
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
    refreshRoom: fetchRoom,
  };
}

export type { FlixPartyParticipant, FlixPartyRoom, FlixPartyChatMessage };
