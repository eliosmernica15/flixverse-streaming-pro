import { pythonFetch } from "@/lib/pythonApi/client";
import { getPythonWsBase, usesHttpTransport } from "@/lib/pythonApi/config";

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
  { urls: "stun:stun1.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

const PEER_STALL_MS = 18_000;
const MAX_SEEN_SIGNALS = 512;

interface PeerState {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  hasRemoteDescription: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  forwardedTrackIds: Set<string>;
  stallTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Shared WebRTC engine for the self-hosted (Python) transport.
 *
 * Mirrors the semantics of the Firestore transport byte for byte, because
 * both feed the exact same sync state machine: perfect negotiation (no offer
 * glare), queued ICE candidates (they frequently precede the offer), caller
 * ownership of local tracks, host-side track forwarding, and a stall watchdog
 * that rebuilds a peer that never connects.
 */
abstract class WebRTCPartySyncBase implements PartySyncTransport {
  protected roomId: string;
  protected userId: string;
  protected isHost: boolean;
  protected hostId: string | null;
  protected peers = new Map<string, PeerState>();
  protected channels = new Map<string, RTCDataChannel>();
  protected remoteStreams = new Map<string, MediaStream>();
  protected localStream: MediaStream | null = null;
  protected onMessage: (msg: unknown) => void;
  protected mediaCallbacks: MediaCallbacks;
  protected seenSignals = new Set<string>();
  protected seenOrder: string[] = [];
  protected destroyed = false;
  protected clonedTracks = new Set<MediaStreamTrack>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.localStream = stream;
    await Promise.all([...this.peers.values()].map((peer) => this.syncLocalTracks(peer)));
  }

  get isConnected(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") return true;
    }
    for (const peer of this.peers.values()) {
      if (peer.pc.connectionState === "connected") return true;
    }
    return false;
  }

  protected createPeer(peerId: string): PeerState {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerState = {
      pc,
      polite: !this.isHost,
      makingOffer: false,
      hasRemoteDescription: false,
      pendingCandidates: [],
      forwardedTrackIds: new Set(),
      stallTimer: null,
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) void this.sendSignal(peerId, "candidate", event.candidate.toJSON());
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (peer.stallTimer) {
          clearTimeout(peer.stallTimer);
          peer.stallTimer = null;
        }
        return;
      }
      if (pc.connectionState === "failed") this.scheduleReconnect(peerId);
      else if (pc.connectionState === "closed") this.closePeer(peerId);
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.remoteStreams.set(peerId, stream);
      this.mediaCallbacks.onRemoteStream?.(peerId, stream);
      event.track.addEventListener("ended", () => {
        this.remoteStreams.delete(peerId);
        this.mediaCallbacks.onRemoteStreamRemoved?.(peerId);
      });
      if (this.isHost) this.forwardStreamToOthers(peerId, stream);
    };

    pc.onnegotiationneeded = () => void this.negotiate(peerId, peer);

    this.peers.set(peerId, peer);
    this.armStallTimer(peerId, peer);
    return peer;
  }

  private armStallTimer(peerId: string, peer: PeerState) {
    if (peer.stallTimer) clearTimeout(peer.stallTimer);
    peer.stallTimer = setTimeout(() => {
      peer.stallTimer = null;
      if (this.destroyed || !this.peers.has(peerId)) return;
      if (peer.pc.connectionState === "connected") return;
      this.scheduleReconnect(peerId);
    }, PEER_STALL_MS);
  }

  private scheduleReconnect(peerId: string) {
    if (this.destroyed) return;
    this.closePeer(peerId);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed || this.peers.has(peerId)) return;
      if (this.isHost) void this.connectAsHost(peerId);
      else if (this.hostId === peerId) void this.connectAsGuest(peerId);
    }, 1200 + Math.random() * 800);
  }

  protected async syncLocalTracks(peer: PeerState) {
    const { pc } = peer;
    const tracks = this.localStream?.getTracks() ?? [];
    for (const track of tracks) {
      const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        if (sender.track !== track) {
          try {
            await sender.replaceTrack(track);
          } catch {
            // mid-renegotiation; retried on the next pass
          }
        }
      } else {
        try {
          pc.addTrack(track, this.localStream!);
        } catch {
          // duplicate
        }
      }
    }
    for (const sender of pc.getSenders()) {
      if (!sender.track) continue;
      if (!tracks.some((t) => t.kind === sender.track!.kind)) {
        try {
          await sender.replaceTrack(null);
        } catch {
          // ignore
        }
      }
    }
  }

  private forwardStreamToOthers(fromPeerId: string, stream: MediaStream) {
    for (const [peerId, peer] of this.peers) {
      if (peerId === fromPeerId) continue;
      for (const track of stream.getTracks()) {
        const key = `${fromPeerId}:${track.id}`;
        if (peer.forwardedTrackIds.has(key)) continue;
        try {
          const cloned = track.clone();
          this.clonedTracks.add(cloned);
          cloned.addEventListener("ended", () => this.clonedTracks.delete(cloned));
          peer.pc.addTrack(cloned, stream);
          peer.forwardedTrackIds.add(key);
        } catch {
          // already attached
        }
      }
    }
  }

  /** Perfect negotiation — the polite (guest) side yields on collision. */
  private async negotiate(peerId: string, peer: PeerState) {
    if (this.destroyed) return;
    const { pc } = peer;
    if (peer.makingOffer) return;
    try {
      peer.makingOffer = true;
      await pc.setLocalDescription(await pc.createOffer());
      await this.sendSignal(peerId, "offer", pc.localDescription);
    } catch (err) {
      if (!this.destroyed) console.warn("[webrtc] offer failed:", err);
    } finally {
      peer.makingOffer = false;
    }
  }

  protected attachChannel(peerId: string, channel: RTCDataChannel) {
    const existing = this.channels.get(peerId);
    if (existing && existing !== channel) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        // ignore
      }
    };
    channel.onclose = () => {
      if (this.channels.get(peerId) === channel) this.channels.delete(peerId);
    };
    this.channels.set(peerId, channel);
  }

  protected async connectAsHost(guestId: string) {
    if (this.destroyed || this.peers.has(guestId)) return;
    const peer = this.createPeer(guestId);
    const channel = peer.pc.createDataChannel("sync", { ordered: true });
    this.attachChannel(guestId, channel);
    await this.syncLocalTracks(peer);
  }

  protected async connectAsGuest(hostId: string) {
    if (this.destroyed || this.peers.has(hostId)) return;
    const peer = this.createPeer(hostId);
    peer.pc.ondatachannel = (event) => this.attachChannel(hostId, event.channel);
    await this.syncLocalTracks(peer);
    if (this.localStream?.getTracks().length) void this.negotiate(hostId, peer);
  }

  protected rememberSignal(key: string): boolean {
    if (this.seenSignals.has(key)) return false;
    this.seenSignals.add(key);
    this.seenOrder.push(key);
    while (this.seenOrder.length > MAX_SEEN_SIGNALS) {
      const evicted = this.seenOrder.shift();
      if (evicted) this.seenSignals.delete(evicted);
    }
    return true;
  }

  protected async ingestSignal(data: SignalMessage & { senderId: string }) {
    // Prefer a stable identity for de-duplication. The previous key was a
    // truncated payload prefix, which collided across renegotiations and
    // silently dropped legitimate answers.
    const key =
      (data as SignalMessage & { id?: string }).id ??
      `${data.senderId}:${data.type}:${data.createdAt}`;
    if (!this.rememberSignal(key)) return;
    await this.handleSignal(data);
  }

  protected async handleSignal(data: SignalMessage & { senderId: string }) {
    if (this.destroyed) return;
    const peerId = data.senderId;
    let peer = this.peers.get(peerId);
    try {
      const payload = JSON.parse(data.payload);

      if (data.type === "offer") {
        if (!peer) {
          peer = this.createPeer(peerId);
          if (!this.isHost) {
            peer.pc.ondatachannel = (e) => this.attachChannel(peerId, e.channel);
          }
        }
        const collision = peer.makingOffer || peer.pc.signalingState !== "stable";
        if (collision && !peer.polite) return;
        if (collision) {
          try {
            await peer.pc.setLocalDescription({ type: "rollback" });
          } catch {
            // engine without rollback support
          }
        }
        await peer.pc.setRemoteDescription(new RTCSessionDescription(payload));
        peer.hasRemoteDescription = true;
        await this.flushCandidates(peer);
        await this.syncLocalTracks(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        await this.sendSignal(peerId, "answer", answer);
        return;
      }

      if (data.type === "answer") {
        if (!peer) return;
        if (peer.pc.signalingState !== "have-local-offer") return;
        await peer.pc.setRemoteDescription(new RTCSessionDescription(payload));
        peer.hasRemoteDescription = true;
        await this.flushCandidates(peer);
        return;
      }

      if (!peer) {
        if (this.isHost) peer = this.createPeer(peerId);
        else if (this.hostId === peerId) peer = this.createPeer(peerId);
        else return;
      }
      if (peer.hasRemoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(payload));
      } else {
        peer.pendingCandidates.push(payload as RTCIceCandidateInit);
      }
    } catch (err) {
      if (this.peers.has(peerId)) console.warn("[webrtc] signal failed:", err);
    }
  }

  private async flushCandidates(peer: PeerState) {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // stale
      }
    }
  }

  protected abstract sendSignal(
    targetId: string,
    type: SignalMessage["type"],
    payload: unknown
  ): Promise<void>;

  sendMessage(message: unknown) {
    let payload: string;
    try {
      payload = JSON.stringify(message);
    } catch {
      return;
    }
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") {
        try {
          channel.send(payload);
        } catch {
          // closed mid-send
        }
      }
    }
  }

  protected closePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer?.stallTimer) {
      clearTimeout(peer.stallTimer);
      peer.stallTimer = null;
    }

    const channel = this.channels.get(peerId);
    if (channel) {
      channel.onclose = null;
      try {
        channel.close();
      } catch {
        // ignore
      }
      this.channels.delete(peerId);
    }

    this.remoteStreams.delete(peerId);
    this.mediaCallbacks.onRemoteStreamRemoved?.(peerId);

    if (peer) {
      for (const sender of peer.pc.getSenders()) {
        const track = sender.track;
        if (track && this.clonedTracks.has(track)) {
          try {
            track.stop();
          } catch {
            // ignore
          }
          this.clonedTracks.delete(track);
        }
      }
      peer.forwardedTrackIds.clear();
      try {
        peer.pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(peerId);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    for (const track of this.clonedTracks) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    this.clonedTracks.clear();
    // The local stream is owned by the caller; never stop its tracks here.
    this.localStream = null;
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
    try {
      this.ws.send(
        JSON.stringify({
          senderId: this.userId,
          targetId,
          type,
          payload: JSON.stringify(payload),
          createdAt: Date.now(),
        })
      );
    } catch {
      // socket closed between the check and the send
    }
  }

  destroy() {
    super.destroy();
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

/** WebRTC party sync via HTTP polling — Vercel production (no WebSockets). */
export class WebRTCPartySyncHttp extends WebRTCPartySyncBase {
  private since = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  /** Set by destroy(); guards every async continuation. */
  private stopped = false;
  // Fast while establishing the peer connection, slow once live: signals
  // only matter during setup. 8 req/s forever was melting machines.
  private static readonly FAST_POLL_MS = 400;
  private static readonly STEADY_POLL_MS = 3000;

  constructor(
    roomId: string,
    userId: string,
    isHost: boolean,
    hostId: string | null,
    onMessage: (msg: unknown) => void,
    mediaCallbacks: MediaCallbacks = {}
  ) {
    super(roomId, userId, isHost, hostId, onMessage, mediaCallbacks);
    this.schedule(WebRTCPartySyncHttp.FAST_POLL_MS);
    void this.pollSignals();
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.pollSignals(), delay);
  }

  private async pollSignals() {
    // Background tab: skip (re-aligns on foreground via room polling).
    // In-flight guard: a stalled request must never stack overlapping ones.
    if (this.stopped || this.destroyed) return;
    if (typeof document !== "undefined" && document.hidden) {
      this.schedule(WebRTCPartySyncHttp.STEADY_POLL_MS);
      return;
    }
    if (this.pollInFlight) return;
    this.pollInFlight = true;
    try {
      const data = await pythonFetch<{ signals: SignalMessage[] }>(
        `/parties/${this.roomId}/signals?since=${this.since}`
      );
      if (this.stopped) return;
      for (const sig of data.signals) {
        if (sig.createdAt > this.since) this.since = sig.createdAt;
        if (sig.targetId && sig.targetId !== this.userId) continue;
        await this.ingestSignal(sig);
      }
      this.schedule(
        this.isConnected
          ? WebRTCPartySyncHttp.STEADY_POLL_MS
          : WebRTCPartySyncHttp.FAST_POLL_MS
      );
    } catch {
      // Back off on failure instead of hammering a dead endpoint.
      this.schedule(WebRTCPartySyncHttp.STEADY_POLL_MS);
    } finally {
      this.pollInFlight = false;
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
    this.stopped = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
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
  if (usesHttpTransport()) {
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
