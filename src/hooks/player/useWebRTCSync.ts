import { useEffect, useRef, useState, useCallback } from "react";
import { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";

export interface SyncMessage {
  type: "play" | "pause" | "seek" | "heartbeat" | "chat";
  timestamp: number;
  data: {
    currentTime?: number;
    text?: string;
    [key: string]: unknown;
  };
}

interface UseWebRTCSyncOptions {
  roomId: string | null;
  isHost?: boolean;
  hostId?: string | null;
  participantIds?: string[];
  onPlaybackSync?: (msg: SyncMessage) => void;
}

export function useWebRTCSync({
  roomId,
  isHost = false,
  hostId = null,
  participantIds = [],
  onPlaybackSync,
}: UseWebRTCSyncOptions) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SyncMessage[]>([]);
  const syncRef = useRef<WebRTCPartySync | null>(null);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  onPlaybackSyncRef.current = onPlaybackSync;

  useEffect(() => {
    void NTPClient.calibrate();
  }, []);

  useEffect(() => {
    if (!roomId || !user) {
      setIsConnected(false);
      return;
    }

    const sync = new WebRTCPartySync(
      roomId,
      user.uid,
      isHost,
      isHost ? null : hostId,
      (raw) => {
        const msg = raw as SyncMessage;
        if (msg.type === "chat") {
          setMessages((prev) => [...prev, msg]);
          return;
        }
        if (["play", "pause", "seek", "heartbeat"].includes(msg.type)) {
          onPlaybackSyncRef.current?.(msg);
        }
      }
    );

    sync.start();
    syncRef.current = sync;

    const poll = setInterval(() => {
      setIsConnected(sync.isConnected);
    }, 1000);

    return () => {
      clearInterval(poll);
      sync.destroy();
      syncRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, user, isHost, hostId]);

  // Host: maintain star connections for all guests
  useEffect(() => {
    if (!isHost || !syncRef.current) return;
    syncRef.current.syncParticipants(participantIds);
  }, [isHost, participantIds.join(",")]);

  const sendMessage = useCallback((type: SyncMessage["type"], data: SyncMessage["data"]) => {
    if (!syncRef.current) return;
    const msg: SyncMessage = {
      type,
      data,
      timestamp: NTPClient.now(),
    };
    syncRef.current.sendMessage(msg);
  }, []);

  return { isConnected, sendMessage, messages };
}
