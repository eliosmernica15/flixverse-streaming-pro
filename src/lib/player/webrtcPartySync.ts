import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";

export interface SignalMessage {
  senderId: string;
  targetId: string;
  type: "offer" | "answer" | "candidate";
  payload: string;
  createdAt: number;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [{
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      }]
    : []),
];

/**
 * Star-topology WebRTC sync — host maintains one peer connection per guest.
 * Guests connect only to the host. Supports N participants (not just 1:1).
 */
export class WebRTCPartySync {
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private hostId: string | null;
  private peers = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private onMessage: (msg: unknown) => void;
  private unsubscribe: (() => void) | null = null;
  private seenSignals = new Set<string>();

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.hostId = hostId;
    this.onMessage = onMessage;
  }

  start() {
    this.listenForSignals();
    if (!this.isHost && this.hostId) {
      void this.connectAsGuest(this.hostId);
    }
  }

  /** Host: sync connections when participant list changes */
  syncParticipants(participantIds: string[]) {
    if (!this.isHost) return;
    const guests = participantIds.filter((id) => id !== this.userId);

    for (const peerId of [...this.peers.keys()]) {
      if (!guests.includes(peerId)) this.closePeer(peerId);
    }

    for (const guestId of guests) {
      if (!this.peers.has(guestId)) void this.connectAsHost(guestId);
    }
  }

  private createPeer(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(peerId, "candidate", event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.closePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private attachChannel(peerId: string, channel: RTCDataChannel) {
    this.channels.set(peerId, channel);
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        // ignore malformed
      }
    };
  }

  private async connectAsHost(guestId: string) {
    const pc = this.createPeer(guestId);
    const channel = pc.createDataChannel("sync");
    this.attachChannel(guestId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal(guestId, "offer", offer);
  }

  private async connectAsGuest(hostId: string) {
    if (this.peers.has(hostId)) return;
    const pc = this.createPeer(hostId);

    pc.ondatachannel = (event) => {
      this.attachChannel(hostId, event.channel);
    };
  }

  private listenForSignals() {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flix_parties", this.roomId, "signals");

    this.unsubscribe = onSnapshot(
      query(signalsRef, where("targetId", "==", this.userId)),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const docId = change.doc.id;
          if (this.seenSignals.has(docId)) return;
          this.seenSignals.add(docId);

          const data = change.doc.data() as SignalMessage;
          void this.handleSignal(data);
        });
      }
    );
  }

  private async handleSignal(data: SignalMessage) {
    const peerId = data.senderId;
    let pc = this.peers.get(peerId);

    try {
      const payload = JSON.parse(data.payload);

      if (data.type === "offer" && !this.isHost) {
        if (!pc) pc = this.createPeer(peerId);
        pc.ondatachannel = (event) => this.attachChannel(peerId, event.channel);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal(peerId, "answer", answer);
      } else if (data.type === "answer" && this.isHost) {
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (data.type === "candidate") {
        if (!pc) {
          if (this.isHost) {
            pc = this.createPeer(peerId);
          } else if (this.hostId === peerId) {
            pc = this.createPeer(peerId);
          } else {
            return;
          }
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      }
    } catch (err) {
      console.warn("WebRTC signal handling failed:", err);
    }
  }

  private async sendSignal(
    targetId: string,
    type: SignalMessage["type"],
    payload: unknown
  ) {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flix_parties", this.roomId, "signals");
    await addDoc(signalsRef, {
      senderId: this.userId,
      targetId,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    });
  }

  /** Broadcast to all connected peers (host) or single host channel (guest) */
  sendMessage(message: unknown) {
    const payload = JSON.stringify(message);
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") {
        channel.send(payload);
      }
    }
  }

  get isConnected(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") return true;
    }
    return false;
  }

  private closePeer(peerId: string) {
    this.channels.get(peerId)?.close();
    this.channels.delete(peerId);
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    this.seenSignals.clear();
  }
}
