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

export interface MediaCallbacks {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved?: (peerId: string) => void;
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
 * Star-topology WebRTC — host maintains one peer connection per guest.
 * Supports data-channel playback sync + optional audio/video with host forwarding.
 */
export class WebRTCPartySync {
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private hostId: string | null;
  private peers = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private remoteStreams = new Map<string, MediaStream>();
  private forwardedTracks = new Map<string, Set<string>>();
  private localStream: MediaStream | null = null;
  private onMessage: (msg: unknown) => void;
  private mediaCallbacks: MediaCallbacks;
  private unsubscribe: (() => void) | null = null;
  private seenSignals = new Set<string>();

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void,
    mediaCallbacks: MediaCallbacks = {}
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.hostId = hostId;
    this.onMessage = onMessage;
    this.mediaCallbacks = mediaCallbacks;
  }

  start() {
    this.listenForSignals();
    if (!this.isHost && this.hostId) {
      void this.connectAsGuest(this.hostId);
    }
  }

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

  /** Attach or replace local camera/mic stream on all peer connections */
  async setLocalStream(stream: MediaStream | null) {
    this.localStream?.getTracks().forEach((t) => {
      if (!stream?.getTracks().some((nt) => nt.id === t.id)) t.stop();
    });
    this.localStream = stream;

    for (const [peerId, pc] of this.peers) {
      await this.syncLocalTracks(peerId, pc);
    }
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
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

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.remoteStreams.set(peerId, stream);
      this.mediaCallbacks.onRemoteStream?.(peerId, stream);

      if (this.isHost) {
        this.forwardStreamToOthers(peerId, stream);
      }
    };

    pc.onnegotiationneeded = () => {
      void this.renegotiate(peerId);
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private async syncLocalTracks(peerId: string, pc: RTCPeerConnection) {
    const senders = pc.getSenders();
    const tracks = this.localStream?.getTracks() ?? [];

    for (const track of tracks) {
      const existing = senders.find((s) => s.track?.kind === track.kind);
      if (existing) {
        await existing.replaceTrack(track);
      } else {
        pc.addTrack(track, this.localStream!);
      }
    }

    for (const sender of senders) {
      if (!sender.track) continue;
      if (!tracks.some((t) => t.kind === sender.track!.kind)) {
        await sender.replaceTrack(null);
      }
    }

    if (pc.signalingState === "stable" && tracks.length > 0) {
      await this.renegotiate(peerId);
    }
  }

  private forwardStreamToOthers(fromPeerId: string, stream: MediaStream) {
    for (const [peerId, pc] of this.peers) {
      if (peerId === fromPeerId) continue;
      const key = `${fromPeerId}:${peerId}`;
      const sent = this.forwardedTracks.get(key) ?? new Set<string>();

      for (const track of stream.getTracks()) {
        if (sent.has(track.id)) continue;
        try {
          const cloned = track.clone();
          pc.addTrack(cloned, stream);
          sent.add(track.id);
        } catch {
          // ignore duplicate track errors
        }
      }
      this.forwardedTracks.set(key, sent);
    }
  }

  private async renegotiate(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || pc.signalingState !== "stable") return;

    try {
      if (this.isHost) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.sendSignal(peerId, "offer", offer);
      } else {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.sendSignal(peerId, "offer", offer);
      }
    } catch {
      // negotiation can race — safe to ignore
    }
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
    if (this.localStream) await this.syncLocalTracks(guestId, pc);

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
    if (this.localStream) await this.syncLocalTracks(hostId, pc);
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

      if (data.type === "offer") {
        if (!pc) {
          pc = this.createPeer(peerId);
          if (!this.isHost) {
            pc.ondatachannel = (event) => this.attachChannel(peerId, event.channel);
          }
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        if (this.localStream) await this.syncLocalTracks(peerId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal(peerId, "answer", answer);
      } else if (data.type === "answer") {
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
    this.remoteStreams.delete(peerId);
    this.mediaCallbacks.onRemoteStreamRemoved?.(peerId);
    for (const key of [...this.forwardedTracks.keys()]) {
      if (key.startsWith(`${peerId}:`) || key.includes(`:${peerId}`)) {
        this.forwardedTracks.delete(key);
      }
    }
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.seenSignals.clear();
    this.forwardedTracks.clear();
  }
}
