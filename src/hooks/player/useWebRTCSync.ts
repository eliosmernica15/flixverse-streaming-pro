import { useEffect, useRef, useState, useCallback } from "react";
import { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
import { createPartySyncTransport, type PartySyncTransport } from "@/lib/player/webrtcPartySyncWs";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";

export interface SyncMessage {
  type: "play" | "pause" | "seek" | "heartbeat" | "chat" | "speaking";
  timestamp: number;
  data: {
    currentTime?: number;
    text?: string;
    speaking?: boolean;
    [key: string]: unknown;
  };
}

export interface RemoteParticipantStream {
  peerId: string;
  stream: MediaStream;
}

interface UseWebRTCSyncOptions {
  roomId: string | null;
  isHost?: boolean;
  hostId?: string | null;
  participantIds?: string[];
  onPlaybackSync?: (msg: SyncMessage) => void;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved?: (peerId: string) => void;
}

export function useWebRTCSync({
  roomId,
  isHost = false,
  hostId = null,
  participantIds = [],
  onPlaybackSync,
  onRemoteStream,
  onRemoteStreamRemoved,
}: UseWebRTCSyncOptions) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SyncMessage[]>([]);
  const syncRef = useRef<WebRTCPartySync | PartySyncTransport | null>(null);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onRemoteStreamRemovedRef = useRef(onRemoteStreamRemoved);
  onPlaybackSyncRef.current = onPlaybackSync;
  onRemoteStreamRef.current = onRemoteStream;
  onRemoteStreamRemovedRef.current = onRemoteStreamRemoved;

  useEffect(() => {
    void NTPClient.calibrate();
  }, []);

  useEffect(() => {
    if (!roomId || !user) {
      setIsConnected(false);
      return;
    }
    if (!isHost && !hostId) return;

    let sync: WebRTCPartySync | PartySyncTransport | null = null;
    let cancelled = false;

    void (async () => {
      const onMsg = (raw: unknown) => {
        const msg = raw as SyncMessage;
        if (msg.type === "chat") {
          setMessages((prev) => [...prev, msg]);
          return;
        }
        if (["play", "pause", "seek", "heartbeat"].includes(msg.type)) {
          onPlaybackSyncRef.current?.(msg);
        }
      };

      const mediaCb = {
        onRemoteStream: (peerId: string, stream: MediaStream) =>
          onRemoteStreamRef.current?.(peerId, stream),
        onRemoteStreamRemoved: (peerId: string) =>
          onRemoteStreamRemovedRef.current?.(peerId),
      };

      if (isPythonBackendEnabled()) {
        sync = await createPartySyncTransport(
          roomId,
          user.uid,
          isHost,
          isHost ? null : hostId,
          onMsg,
          mediaCb
        );
        if (cancelled) {
          sync.destroy();
          return;
        }
      } else {
        const firestoreSync = new WebRTCPartySync(
          roomId,
          user.uid,
          isHost,
          isHost ? null : hostId,
          onMsg,
          mediaCb
        );
        firestoreSync.start();
        sync = firestoreSync;
      }

      syncRef.current = sync;
    })();

    const poll = setInterval(() => {
      if (syncRef.current) setIsConnected(syncRef.current.isConnected);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      syncRef.current?.destroy();
      syncRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, user, isHost, hostId]);

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

  const setLocalStream = useCallback(async (stream: MediaStream | null) => {
    await syncRef.current?.setLocalStream(stream);
  }, []);

  return { isConnected, sendMessage, messages, setLocalStream, syncRef };
}
