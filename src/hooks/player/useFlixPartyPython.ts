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

export function useFlixPartyPython({ roomId }: UseFlixPartyOptions) {
  const { user } = useAuth();
  const [room, setRoom] = useState<FlixPartyRoom | null>(null);
  const [messages, setMessages] = useState<FlixPartyChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    try {
      const data = await pythonFetch<{ room: FlixPartyRoom }>(`/parties/${roomId}`);
      setRoom(data.room);
    } catch {
      setRoom(null);
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

    pollRef.current = setInterval(() => {
      void fetchRoom();
      void fetchMessages();
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
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

  const joinRoom = useCallback(async (_code: string): Promise<string | null> => {
    return null;
  }, []);

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
      try {
        await pythonFetch(`/parties/${roomId}/playback`, {
          method: "PATCH",
          body: JSON.stringify({ state, currentTime }),
        });
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
      } catch {
        /* host-only */
      }
    },
    [roomId]
  );

  const kickParticipant = useCallback(async (_targetUserId: string) => {
    /* optional future */
  }, []);

  const setParticipantMicMuted = useCallback(async (_targetUserId: string, _muted: boolean) => {
    /* optional future */
  }, []);

  const setParticipantCamDisabled = useCallback(async (_targetUserId: string, _disabled: boolean) => {
    /* optional future */
  }, []);

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

export type { FlixPartyParticipant, FlixPartyRoom, FlixPartyChatMessage };
