import { pythonFetch } from "@/lib/pythonApi/client";
import { getPythonWsBase, useHttpTransport } from "@/lib/pythonApi/config";

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

export interface PartySyncTransport {
  syncParticipants(participantIds: string[]): void;
  setLocalStream(stream: MediaStream | null): Promise<void>;
  sendMessage(message: unknown): void;
  readonly isConnected: boolean;
  destroy(): void;
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

abstract class WebRTCPartySyncBase implements PartySyncTransport {
  protected roomId: string;
  protected userId: string;
  protected isHost: boolean;
  protected hostId: string | null;
  protected peers = new Map<string, RTCPeerConnection>();
  protected channels = new Map<string, RTCDataChannel>();
  protected remoteStreams = new Map<string, MediaStream>();
  protected localStream: MediaStream | null = null;
  protected onMessage: (msg: unknown) => void;
  protected mediaCallbacks: MediaCallbacks;
  protected seenSignals = new Set<string>();

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
      await this.renegotiate(peerId, pc);
    }
  }

  protected async renegotiate(peerId: string, pc: RTCPeerConnection) {
    if (!this.localStream?.getTracks().length) return;
    if (pc.signalingState !== "stable") return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(peerId, "offer", offer);
    } catch {
      /* ICE may still be negotiating */
    }
  }

  protected createPeer(peerId: string): RTCPeerConnection {
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

  protected async syncLocalTracks(peerId: string, pc: RTCPeerConnection) {
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

  protected attachChannel(peerId: string, channel: RTCDataChannel) {
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        /* ignore */
      }
    };
    this.channels.set(peerId, channel);
  }

  protected async connectAsHost(guestId: string) {
    const pc = this.createPeer(guestId);
    const channel = pc.createDataChannel("sync");
    this.attachChannel(guestId, channel);
    if (this.localStream) await this.syncLocalTracks(guestId, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal(guestId, "offer", offer);
  }

  protected async connectAsGuest(hostId: string) {
    if (this.peers.has(hostId)) return;
    const pc = this.createPeer(hostId);
    pc.ondatachannel = (event) => this.attachChannel(hostId, event.channel);
    if (this.localStream) await this.syncLocalTracks(hostId, pc);
  }

  protected async ingestSignal(data: SignalMessage & { senderId: string }) {
    const key = `${data.senderId}:${data.type}:${data.payload?.slice?.(0, 40) ?? ""}`;
    if (this.seenSignals.has(key)) return;
    this.seenSignals.add(key);
    await this.handleSignal(data);
  }

  protected async handleSignal(data: SignalMessage & { senderId: string }) {
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
      console.warn("WebRTC signal failed:", err);
    }
  }

  protected abstract sendSignal(targetId: string, type: SignalMessage["type"], payload: unknown): Promise<void>;

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
    for (const pc of this.peers.values()) {
      if (pc.connectionState === "connected") {
        return true;
      }
    }
    return false;
  }

  protected closePeer(peerId: string) {
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
  }
}

/** WebRTC party sync via Python WebSocket — local dev only. */
export class WebRTCPartySyncWs extends WebRTCPartySyncBase {
  private ws: WebSocket;

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void,
    mediaCallbacks: MediaCallbacks,
    ws: WebSocket
  ) {
    super(roomId, userId, isHost, hostId, onMessage, mediaCallbacks);
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as SignalMessage & { senderId: string };
        if (data.targetId && data.targetId !== this.userId) return;
        void this.ingestSignal(data);
      } catch {
        /* ignore non-signal messages */
      }
    };
  }

  protected async sendSignal(targetId: string, type: SignalMessage["type"], payload: unknown) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
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

  destroy() {
    super.destroy();
    this.ws.close();
  }
}

/** WebRTC party sync via HTTP polling — Vercel production (no WebSockets). */
export class WebRTCPartySyncHttp extends WebRTCPartySyncBase {
  private since = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void,
    mediaCallbacks: MediaCallbacks = {}
  ) {
    super(roomId, userId, isHost, hostId, onMessage, mediaCallbacks);
    this.pollTimer = setInterval(() => void this.pollSignals(), 120);
    void this.pollSignals();
  }

  private async pollSignals() {
    try {
      const data = await pythonFetch<{ signals: SignalMessage[] }>(
        `/parties/${this.roomId}/signals?since=${this.since}`
      );
      for (const sig of data.signals) {
        if (sig.createdAt > this.since) this.since = sig.createdAt;
        if (sig.targetId && sig.targetId !== this.userId) continue;
        await this.ingestSignal(sig);
      }
    } catch {
      /* retry on next poll */
    }
  }

  protected async sendSignal(targetId: string, type: SignalMessage["type"], payload: unknown) {
    try {
      await pythonFetch(`/parties/${this.roomId}/signals`, {
        method: "POST",
        body: JSON.stringify({
          targetId,
          type,
          payload: JSON.stringify(payload),
        }),
      });
      void this.pollSignals();
    } catch (err) {
      console.warn("HTTP signal send failed:", err);
    }
  }

  destroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    super.destroy();
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

export async function createPartySyncTransport(
  roomId: string,
  userId: string,
  isHost: boolean,
  hostId: string | null,
  onMessage: (msg: unknown) => void,
  mediaCallbacks: MediaCallbacks = {}
): Promise<PartySyncTransport> {
  if (useHttpTransport()) {
    return new WebRTCPartySyncHttp(roomId, userId, isHost, hostId, onMessage, mediaCallbacks);
  }

  const { getFirebaseAuth } = await import("@/integrations/firebase/client");
  const token = await getFirebaseAuth()?.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const ws = await openPartyWebSocket(roomId, token);
  return new WebRTCPartySyncWs(roomId, userId, isHost, hostId, onMessage, mediaCallbacks, ws);
}

// Re-export Firestore version for fallback
export { WebRTCPartySync } from "@/lib/player/webrtcPartySync";
