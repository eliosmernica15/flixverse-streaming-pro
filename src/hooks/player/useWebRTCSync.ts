import { useEffect, useRef, useState, useCallback } from "react";
import { WebRTCSignaling } from "@/lib/player/webrtcSignaling";
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
  onPlaybackSync?: (msg: SyncMessage) => void;
}

export function useWebRTCSync({
  roomId,
  isHost = false,
  onPlaybackSync,
}: UseWebRTCSyncOptions) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SyncMessage[]>([]);
  const signalingRef = useRef<WebRTCSignaling | null>(null);
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

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const sig = new WebRTCSignaling(roomId, user.uid, pc, (raw) => {
      const msg = raw as SyncMessage;
      if (msg.type === "chat") {
        setMessages((prev) => [...prev, msg]);
        return;
      }
      if (["play", "pause", "seek", "heartbeat"].includes(msg.type)) {
        onPlaybackSyncRef.current?.(msg);
      }
    }, isHost);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sig.sendSignal("candidate", event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      setIsConnected(pc.connectionState === "connected");
    };

    sig.listenForSignals();
    if (isHost) {
      void sig.initAsHost();
    }

    signalingRef.current = sig;

    return () => {
      sig.destroy();
      signalingRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, user, isHost]);

  const sendMessage = useCallback((type: SyncMessage["type"], data: SyncMessage["data"]) => {
    if (!signalingRef.current) return;
    const msg: SyncMessage = {
      type,
      data,
      timestamp: NTPClient.now(),
    };
    signalingRef.current.sendMessage(msg);
  }, []);

  return { isConnected, sendMessage, messages };
}
