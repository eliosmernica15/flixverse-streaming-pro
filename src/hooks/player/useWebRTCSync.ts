import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
import { createPartySyncTransport, type PartySyncTransport } from "@/lib/player/webrtcPartySyncWs";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";

export interface SyncMessage {
  type:
    | "play"
    | "pause"
    | "seek"
    | "heartbeat"
    | "chat"
    | "speaking"
    | "server-change"
    | "sync-stage"
    | "sync-go";
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

/**
 * Self-hosted WebRTC party sync (Firestore signaling).
 *
 * Handles the media plane (camera/mic forwarding between host and guests)
 * and a low-latency data-channel channel for playback sync messages. No
 * third-party pubsub — signaling is Firestore subcollection snapshots,
 * the same primitives we use for the chat and the room doc.
 */
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

  // Depend on the uid, not the whole Firebase user object: that object is
  // replaced on every token refresh / profile update, which would tear down
  // the peer connections mid-call. `uid` is the only field this effect reads.
  const uid = user?.uid ?? null;

  /**
   * Stable ref for the roster. Declared above the effect that builds the
   * transport so that effect can seed it without a stale read; the value is
   * refreshed on every render below.
   */
  const participantKeyRef = useRef("");

  useEffect(() => {
    if (!roomId || !uid) {
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
        // Playback + party-control traffic shares one handler so every
        // delivery path (events, room poll, RTC) lands the same state
        // machine. Unknown types are ignored, never crash.
        if (
          [
            "play",
            "pause",
            "seek",
            "heartbeat",
            "server-change",
            "sync-stage",
            "sync-go",
          ].includes(msg.type)
        ) {
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
          uid,
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
          uid,
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

      // Apply the roster that is current *now* — the effect that watches it
      // already ran while this async IIFE was still awaiting.
      if (isHost) {
        const key = participantKeyRef.current;
        sync.syncParticipants(key ? key.split("|") : []);
      }
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
  }, [roomId, uid, isHost, hostId]);

  // Participants arrive as a fresh array every render. Key the effect on the
  // *stable* joined id list (computed with useMemo) so an unchanged roster
  // never re-runs `syncParticipants`, which would tear down and rebuild every
  // RTCPeerConnection on each parent render.
  const participantKey = useMemo(() => participantIds.join("|"), [participantIds]);

  useEffect(() => {
    if (!isHost || !syncRef.current) return;
    // Read the ids back from the key so the effect has no array identity
    // dependency and stays statically checkable.
    const ids = participantKey ? participantKey.split("|") : [];
    syncRef.current.syncParticipants(ids);
  }, [isHost, participantKey]);

  // Latest roster, read by the connection effect when the transport is
  // finally constructed.
  //
  // The transport is created asynchronously, so a roster that arrived while it
  // was being built used to be dropped on the floor: the host's first guest
  // got no peer connection until some *unrelated* roster change happened
  // later, which is why the first camera in a party often stayed black.
  participantKeyRef.current = participantKey;

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

  return {
    isConnected: rtcConnected,
    sendMessage: sendMessageRtc,
    messages,
    setLocalStream: setLocalStreamRtc,
    syncRef,
  };
}
