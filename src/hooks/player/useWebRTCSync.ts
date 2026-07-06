import { useEffect, useRef, useState, useCallback } from "react";
import { WebRTCSignaling } from "@/lib/player/webrtcSignaling";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";

export interface SyncMessage {
  type: "play" | "pause" | "seek" | "heartbeat" | "chat";
  timestamp: number;
  data: any;
}

export function useWebRTCSync(roomId: string | null) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SyncMessage[]>([]);
  const signalingRef = useRef<WebRTCSignaling | null>(null);

  useEffect(() => {
    NTPClient.calibrate();
  }, []);

  useEffect(() => {
    if (!roomId || !user) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const sig = new WebRTCSignaling(roomId, user.uid, pc, (msg: SyncMessage) => {
      if (msg.type === "chat") {
        setMessages((prev) => [...prev, msg]);
      } else {
        // Handle playback sync
        console.log("Received sync event", msg);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sig.sendSignal("candidate", event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      setIsConnected(pc.connectionState === "connected");
    };

    sig.listenForSignals();
    signalingRef.current = sig;

    return () => {
      sig.destroy();
    };
  }, [roomId, user]);

  const sendMessage = useCallback((type: SyncMessage["type"], data: any) => {
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
