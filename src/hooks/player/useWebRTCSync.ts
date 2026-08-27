import { useEffect, useRef, useState, useCallback } from "react";
import { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
import { createPartySyncTransport, type PartySyncTransport } from "@/lib/player/webrtcPartySyncWs";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { useAblyPartySync } from "@/hooks/player/useAblyPartySync";

const ABLY_ENABLED =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_ABLY_API_KEY &&
  process.env.NEXT_PUBLIC_ABLY_API_KEY !== "undefined" &&
  !process.env.NEXT_PUBLIC_ABLY_API_KEY.includes("your_ably_api_key");

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

  // ── Ably path (preferred when API key is configured) ──────────────────────
  const ably = useAblyPartySync({
    roomId: ABLY_ENABLED ? roomId : null,
    isHost,
    onPlaybackSync,
    onRemoteStream,
    onRemoteStreamRemoved,
  });

  // ── WebRTC path (fallback when no Ably key) ───────────────────────────────
  const [rtcConnected, setRtcConnected] = useState(false);
  const [messages, setMessages] = useState<SyncMessage[]>([]);
  const syncRef = useRef<WebRTCPartySync | PartySyncTransport | null>(null);
  const syncInitRef = useRef<{ roomId: string; isHost: boolean; hostId: string | null } | null>(null);
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
    // Skip WebRTC setup when Ably is active
    if (ABLY_ENABLED) return;
    if (!roomId || !user) {
      setRtcConnected(false);
      return;
    }
    if (!isHost && !hostId) return;

    const resolvedHostId = isHost ? null : hostId;
    if (
      syncRef.current &&
      syncInitRef.current?.roomId === roomId &&
      syncInitRef.current?.isHost === isHost &&
      syncInitRef.current?.hostId === resolvedHostId
    ) {
      const poll = setInterval(() => {
        if (syncRef.current) setRtcConnected(syncRef.current.isConnected);
      }, 200);
      return () => clearInterval(poll);
    }

    let sync: WebRTCPartySync | PartySyncTransport | null = null;
    let cancelled = false;

    syncRef.current?.destroy();
    syncRef.current = null;

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
      syncInitRef.current = { roomId, isHost, hostId: resolvedHostId };
    })();

    const poll = setInterval(() => {
      if (syncRef.current) setRtcConnected(syncRef.current.isConnected);
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(poll);
      syncRef.current?.destroy();
      syncRef.current = null;
      syncInitRef.current = null;
      setRtcConnected(false);
    };
  }, [roomId, user?.uid, isHost, hostId]);

  useEffect(() => {
    if (ABLY_ENABLED) return;
    if (!isHost || !syncRef.current) return;
    syncRef.current.syncParticipants(participantIds);
  }, [isHost, participantIds.join(",")]);

  const sendMessageRtc = useCallback((type: SyncMessage["type"], data: SyncMessage["data"]) => {
    if (!syncRef.current) return;
    const msg: SyncMessage = {
      type,
      data,
      timestamp: NTPClient.now(),
    };
    syncRef.current.sendMessage(msg);
  }, []);

  const setLocalStreamRtc = useCallback(async (stream: MediaStream | null) => {
    await syncRef.current?.setLocalStream(stream);
  }, []);

  // ── Unified interface ─────────────────────────────────────────────────────
  if (ABLY_ENABLED) {
    return {
      isConnected: ably.isConnected,
      sendMessage: ably.sendMessage,
      messages: [],
      setLocalStream: ably.setLocalStream,
      syncRef,
    };
  }

  return {
    isConnected: rtcConnected,
    sendMessage: sendMessageRtc,
    messages,
    setLocalStream: setLocalStreamRtc,
    syncRef,
  };
}
