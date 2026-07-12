import { getPythonWsBase } from "@/lib/pythonApi/config";

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

/** WebRTC party sync via Python WebSocket — zero Firestore signal writes. */
export class WebRTCPartySyncWs {
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
  private ws: WebSocket | null = null;
  private seenSignals = new Set<string>();

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void,
    mediaCallbacks: MediaCallbacks = {},
    ws: WebSocket
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.hostId = hostId;
    this.onMessage = onMessage;
    this.mediaCallbacks = mediaCallbacks;
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as SignalMessage & { senderId: string };
        if (data.targetId && data.targetId !== this.userId) return;
        const key = `${data.senderId}:${data.type}:${data.payload?.slice?.(0, 40) ?? ""}`;
        if (this.seenSignals.has(key)) return;
        this.seenSignals.add(key);
        void this.handleSignal(data);
      } catch {
        /* ignore non-signal messages */
      }
    };
    if (!this.isHost && this.hostId) void this.connectAsGuest(this.hostId);
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

  async setLocalStream(stream: MediaStream | null) {
    this.localStream?.getTracks().forEach((t) => {
      if (!stream?.getTracks().some((nt) => nt.id === t.id)) t.stop();
    });
    this.localStream = stream;
    for (const [peerId, pc] of this.peers) {
      await this.syncLocalTracks(peerId, pc);
    }
  }

  private createPeer(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (event) => {
      if (event.candidate) void this.sendSignal(peerId, "candidate", event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.closePeer(peerId);
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStreams.set(peerId, stream);
      this.mediaCallbacks.onRemoteStream?.(peerId, stream);
    };
    this.peers.set(peerId, pc);
    return pc;
  }

  private async syncLocalTracks(peerId: string, pc: RTCPeerConnection) {
    const senders = pc.getSenders();
    for (const track of this.localStream?.getTracks() || []) {
      const existing = senders.find((s) => s.track?.kind === track.kind);
      if (existing) await existing.replaceTrack(track);
      else pc.addTrack(track, this.localStream!);
    }
    if (!this.localStream) {
      for (const sender of senders) await sender.replaceTrack(null);
    }
  }

  private attachChannel(peerId: string, channel: RTCDataChannel) {
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        /* ignore */
      }
    };
    this.channels.set(peerId, channel);
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
    pc.ondatachannel = (event) => this.attachChannel(hostId, event.channel);
    if (this.localStream) await this.syncLocalTracks(hostId, pc);
  }

  private async handleSignal(data: SignalMessage & { senderId: string }) {
    const peerId = data.senderId;
    let pc = this.peers.get(peerId);
    try {
      const payload = JSON.parse(data.payload);
      if (data.type === "offer") {
        if (!pc) {
          pc = this.createPeer(peerId);
          if (!this.isHost) pc.ondatachannel = (e) => this.attachChannel(peerId, e.channel);
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
          if (this.isHost) pc = this.createPeer(peerId);
          else if (this.hostId === peerId) pc = this.createPeer(peerId);
          else return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      }
    } catch (err) {
      console.warn("WebRTC WS signal failed:", err);
    }
  }

  private async sendSignal(targetId: string, type: SignalMessage["type"], payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        senderId: this.userId,
        targetId,
        type,
        payload: JSON.stringify(payload),
        createdAt: Date.now(),
      })
    );
  }

  sendMessage(message: unknown) {
    const payload = JSON.stringify(message);
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") channel.send(payload);
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
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }

  destroy() {
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    this.ws = null;
  }
}

export async function openPartyWebSocket(roomId: string, token: string): Promise<WebSocket> {
  const base = getPythonWsBase();
  const ws = new WebSocket(`${base}/ws/party/${roomId}?token=${encodeURIComponent(token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("Party WebSocket failed"));
  });
  return ws;
}

// Re-export Firestore version for fallback
export { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
