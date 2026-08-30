/**
 * Drop-in replacement for useWebRTCSync that uses Ably pub/sub.
 *
 * Same interface, simpler internals — no WebRTC negotiation, no STUN/TURN,
 * no data channel setup. Ably delivers messages in < 50 ms worldwide.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AblyPartyChannel, isValidAblyApiKey, type PartySyncMessage } from "@/lib/player/ablyPartySync";
import { useAuth } from "@/hooks/useAuth";

// Re-export the message type under the same name the rest of the app uses
export type { PartySyncMessage as SyncMessage };

interface UseAblyPartySyncOptions {
  roomId: string | null;
  isHost?: boolean;
  onPlaybackSync?: (msg: PartySyncMessage) => void;
  // Camera/mic streams are still handled by usePartyMedia via WebRTC separately
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved?: (peerId: string) => void;
}

export function useAblyPartySync({
  roomId,
  onPlaybackSync,
}: UseAblyPartySyncOptions) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<AblyPartyChannel | null>(null);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  onPlaybackSyncRef.current = onPlaybackSync;

  useEffect(() => {
    if (!roomId || !user || !isValidAblyApiKey(process.env.NEXT_PUBLIC_ABLY_API_KEY)) {
      setIsConnected(false);
      return;
    }

    // Clean up previous channel
    channelRef.current?.destroy();

    const ch = new AblyPartyChannel(roomId, (msg) => {
      const { type } = msg;
      if (["play", "pause", "seek", "heartbeat", "speaking"].includes(type)) {
        onPlaybackSyncRef.current?.(msg);
      }
    });

    channelRef.current = ch;

    // Poll connection state
    const poll = setInterval(() => {
      setIsConnected(ch.isConnected);
    }, 300);

    return () => {
      clearInterval(poll);
      ch.destroy();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, user?.uid]);

  const sendMessage = useCallback(
    (type: PartySyncMessage["type"], data: PartySyncMessage["data"]) => {
      channelRef.current?.publish(type, data);
    },
    []
  );

  // Stub — media streams still go through usePartyMedia / WebRTC separately
  const setLocalStream = useCallback(async (_stream: MediaStream | null) => {
    // no-op for Ably transport; media handled by usePartyMedia
  }, []);

  // syncParticipants is a no-op for Ably (channels are broadcast, not peer-to-peer)
  const syncParticipants = useCallback((_ids: string[]) => {}, []);

  return {
    isConnected,
    sendMessage,
    setLocalStream,
    syncParticipants,
    messages: [] as PartySyncMessage[],
  };
}
