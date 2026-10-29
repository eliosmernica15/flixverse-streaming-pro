import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  limit,
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

/**
 * ICE configuration.
 *
 * A public STUN server alone only works when at least one side is directly
 * reachable. Two guests behind symmetric NAT need a relay; without one the
 * connection simply never establishes and the party silently degrades to the
 * Firestore event channel (which is why that fallback exists). TURN
 * credentials come from the environment when the deployment provides them.
 */
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

/** Cap on remembered signal ids, so a multi-hour party cannot grow one Set forever. */
const MAX_SEEN_SIGNALS = 512;
/** Give up on a peer that never reaches `connected` and rebuild it. */
const PEER_STALL_MS = 18_000;
/** Signals older than this are undeliverable (target gone) and are pruned. */
const SIGNAL_TTL_MS = 120_000;

interface PeerState {
  pc: RTCPeerConnection;
  /** Guests answer; host offers. Used for perfect-negotiation politeness. */
  polite: boolean;
  /** Set while an offer is being created, to serialise negotiation. */
  makingOffer: boolean;
  /** True once a remote description has been applied. */
  hasRemoteDescription: boolean;
  /** ICE candidates that arrived before the remote description. */
  pendingCandidates: RTCIceCandidateInit[];
  /** Tracks this peer has been given from other guests (host forwarding). */
  forwardedTrackIds: Set<string>;
  connectedAt: number | null;
  stallTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Star-topology WebRTC — the host keeps one peer connection per guest, syncs
 * over a data channel, and optionally forwards everyone's camera/mic to
 * everyone else.
 *
 * Hard-won details this implementation gets right:
 *
 *  - **No offer glare.** Both sides can legitimately want to renegotiate when
 *    a camera turns on. Uncoordinated offers deadlock the connection
 *    (`setRemoteDescription` throws on a collision and the peer is stuck
 *    forever). We use the perfect-negotiation pattern: the guest is "polite"
 *    and rolls back its own offer if an incoming one collides.
 *
 *  - **Candidate ordering.** ICE candidates routinely arrive before the
 *    offer/answer that describes them. Adding them early throws and the
 *    candidate is lost, so the connection stalls on a network path that
 *    should have worked. Candidates are queued until the remote description
 *    lands.
 *
 *  - **Track ownership.** The local `MediaStream` belongs to the caller.
 *    This class never stops its tracks — a renegotiation (host handover,
 *    roster change) must not kill the user's microphone.
 *
 *  - **Reconnection.** A `failed` connection used to close the peer and wait
 *    for the roster to change, which never happens mid-film. Each peer now
 *    gets a stall timer that tears the connection down and rebuilds it.
 */
export class WebRTCPartySync {
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private hostId: string | null;
  private peers = new Map<string, PeerState>();
  private channels = new Map<string, RTCDataChannel>();
  private remoteStreams = new Map<string, MediaStream>();
  /** Tracks this instance created by cloning another peer's track. */
  private clonedTracks = new Set<MediaStreamTrack>();
  private localStream: MediaStream | null = null;
  private onMessage: (msg: unknown) => void;
  private mediaCallbacks: MediaCallbacks;
  private unsubscribe: (() => void) | null = null;
  private seenSignals = new Set<string>();
  private seenOrder: string[] = [];
  private destroyed = false;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
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
  }

  start() {
    this.listenForSignals();
    if (!this.isHost && this.hostId) {
      void this.connectAsGuest(this.hostId);
    }
    this.pruneTimer = setInterval(() => void this.pruneStaleSignals(), SIGNAL_TTL_MS);
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

  /** True when at least one peer can carry data-channel traffic right now. */
  get isConnected(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") return true;
    }
    for (const peer of this.peers.values()) {
      if (peer.pc.connectionState === "connected") return true;
    }
    return false;
  }

  /** Live media-call diagnostics for the UI. */
  getConnectionQuality(): { peers: number; connected: number; channelsOpen: number } {
    let connected = 0;
    for (const peer of this.peers.values()) {
      if (peer.pc.connectionState === "connected") connected += 1;
    }
    let channelsOpen = 0;
    for (const channel of this.channels.values()) {
      if (channel.readyState === "open") channelsOpen += 1;
    }
    return { peers: this.peers.size, connected, channelsOpen };
  }

  /**
   * Attach or replace the local camera/mic stream. Sender tracks are swapped
   * in place (`replaceTrack`) so no renegotiation is needed for the common
   * mute/unmute case, which is what keeps toggling a camera snappy.
   */
  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    await Promise.all(
      [...this.peers.values()].map((peer) => this.syncLocalTracks(peer))
    );
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  // ── Peer lifecycle ──────────────────────────────────────────────────

  private createPeer(peerId: string): PeerState {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerState = {
      pc,
      polite: !this.isHost,
      makingOffer: false,
      hasRemoteDescription: false,
      pendingCandidates: [],
      forwardedTrackIds: new Set(),
      connectedAt: null,
      stallTimer: null,
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(peerId, "candidate", event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        peer.connectedAt = Date.now();
        if (peer.stallTimer) {
          clearTimeout(peer.stallTimer);
          peer.stallTimer = null;
        }
        return;
      }
      if (pc.connectionState === "failed") {
        // A hard failure will not recover on its own. Rebuild shortly —
        // immediately would race the ICE restart and usually fail again.
        this.scheduleReconnect(peerId);
      } else if (pc.connectionState === "closed") {
        this.closePeer(peerId);
      }
    };

    pc.ontrack = (event) => {
      const inbound = event.streams[0];
      const stream = inbound ?? new MediaStream([event.track]);

      this.remoteStreams.set(peerId, stream);
      this.mediaCallbacks.onRemoteStream?.(peerId, stream);

      // A camera turning on mid-call delivers a *new* track on the same
      // stream. Attach a cleanup so the stream we publish stays accurate.
      event.track.addEventListener("ended", () => {
        this.mediaCallbacks.onRemoteStreamRemoved?.(peerId);
        this.remoteStreams.delete(peerId);
      });

      if (this.isHost) this.forwardStreamToOthers(peerId, stream);
    };

    pc.onnegotiationneeded = () => {
      void this.negotiate(peerId, peer);
    };

    this.peers.set(peerId, peer);
    this.armStallTimer(peerId, peer);
    return peer;
  }

  /**
   * Watchdog for a peer that never becomes usable. Without this a peer whose
   * first offer was lost stays "connecting" forever and the guest sees no
   * camera for the rest of the film.
   */
  private armStallTimer(peerId: string, peer: PeerState) {
    if (peer.stallTimer) clearTimeout(peer.stallTimer);
    peer.stallTimer = setTimeout(() => {
      peer.stallTimer = null;
      if (this.destroyed) return;
      if (!this.peers.has(peerId)) return;
      if (peer.pc.connectionState === "connected") return;
      this.scheduleReconnect(peerId);
    }, PEER_STALL_MS);
  }

  private scheduleReconnect(peerId: string) {
    if (this.destroyed) return;
    this.closePeer(peerId, { keepStream: false });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed || this.peers.has(peerId)) return;
      if (this.isHost) void this.connectAsHost(peerId);
      else if (this.hostId === peerId) void this.connectAsGuest(peerId);
    }, 1200 + Math.random() * 800);
  }

  private async syncLocalTracks(peer: PeerState) {
    const { pc } = peer;
    const tracks = this.localStream?.getTracks() ?? [];

    for (const track of tracks) {
      const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        // `replaceTrack` is the cheap path: no renegotiation, no glitch on
        // the remote tile. Only fall back to addTrack when we have no sender.
        if (sender.track !== track) {
          try {
            await sender.replaceTrack(track);
          } catch {
            // The sender may be mid-renegotiation; the next pass fixes it.
          }
        }
      } else {
        try {
          pc.addTrack(track, this.localStream!);
        } catch {
          // Duplicate track — already attached.
        }
      }
    }

    // A muted camera stops sending: null the sender rather than leaving a
    // black frame on everyone else's screen.
    for (const sender of pc.getSenders()) {
      if (!sender.track) continue;
      const stillWanted = tracks.some((t) => t.kind === sender.track!.kind);
      if (!stillWanted) {
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
          // Track already present on this connection.
        }
      }
    }
  }

  // ── Negotiation ─────────────────────────────────────────────────────

  /**
   * Perfect negotiation. The impolite peer wins a collision; the polite peer
   * rolls back its own offer and answers instead. Without the rollback both
   * sides wait for an answer that will never come.
   */
  private async negotiate(peerId: string, peer: PeerState) {
    if (this.destroyed) return;
    const { pc } = peer;
    if (peer.makingOffer) return;

    try {
      peer.makingOffer = true;
      await pc.setLocalDescription(await pc.createOffer());
      await this.sendSignal(peerId, "offer", pc.localDescription);
    } catch (err) {
      // Rollback races and shutdown both land here; the connection state
      // handler owns recovery.
      if (!this.destroyed) console.warn("[webrtc] offer failed:", err);
    } finally {
      peer.makingOffer = false;
    }
  }

  private attachChannel(peerId: string, channel: RTCDataChannel) {
    const existing = this.channels.get(peerId);
    if (existing && existing !== channel) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }
    this.channels.set(peerId, channel);
    channel.binaryType = "arraybuffer";
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        // ignore malformed
      }
    };
    channel.onclose = () => {
      if (this.channels.get(peerId) === channel) this.channels.delete(peerId);
    };
  }

  private async connectAsHost(guestId: string) {
    if (this.destroyed || this.peers.has(guestId)) return;
    const peer = this.createPeer(guestId);
    // Creating the channel fires `negotiationneeded`, which produces the
    // offer. We deliberately do not create a second offer here.
    const channel = peer.pc.createDataChannel("sync", { ordered: true });
    this.attachChannel(guestId, channel);
    await this.syncLocalTracks(peer);
  }

  private async connectAsGuest(hostId: string) {
    if (this.destroyed || this.peers.has(hostId)) return;
    const peer = this.createPeer(hostId);
    peer.pc.ondatachannel = (event) => this.attachChannel(hostId, event.channel);
    await this.syncLocalTracks(peer);
    // A guest with a live camera needs to offer so the host receives it.
    // (A guest that is only watching waits for the host's offer.)
    if (this.localStream?.getTracks().length) {
      void this.negotiate(hostId, peer);
    }
  }

  // ── Signaling ───────────────────────────────────────────────────────

  private listenForSignals() {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flix_parties", this.roomId, "signals");

    this.unsubscribe = onSnapshot(
      query(signalsRef, where("targetId", "==", this.userId)),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== "added") continue;
          const docId = change.doc.id;
          if (this.seenSignals.has(docId)) continue;
          this.rememberSignal(docId);

          const data = change.doc.data() as SignalMessage;
          void this.handleSignal(data).finally(() => {
            void deleteDoc(change.doc.ref).catch(() => undefined);
          });
        }
      }
    );
  }

  private rememberSignal(id: string) {
    this.seenSignals.add(id);
    this.seenOrder.push(id);
    while (this.seenOrder.length > MAX_SEEN_SIGNALS) {
      const evicted = this.seenOrder.shift();
      if (evicted) this.seenSignals.delete(evicted);
    }
  }

  /**
   * Delete signaling docs addressed to us that were never delivered (the
   * sender left, or the tab closed between write and read). Without this the
   * subcollection grows without bound and every listener pays for it.
   */
  private async pruneStaleSignals() {
    if (this.destroyed) return;
    try {
      const db = requireFirebaseDb();
      const signalsRef = collection(db, "flix_parties", this.roomId, "signals");
      const snap = await getDocs(
        query(signalsRef, where("targetId", "==", this.userId), limit(120))
      );
      const cutoff = Date.now() - SIGNAL_TTL_MS;
      await Promise.all(
        snap.docs
          .filter((d) => (d.data().createdAt ?? 0) < cutoff)
          .map((d) => deleteDoc(d.ref).catch(() => undefined))
      );
    } catch {
      // best effort
    }
  }

  private async handleSignal(data: SignalMessage) {
    if (this.destroyed) return;
    const peerId = data.senderId;
    let peer = this.peers.get(peerId);

    try {
      const payload = JSON.parse(data.payload);

      if (data.type === "offer") {
        if (!peer) {
          peer = this.createPeer(peerId);
          if (!this.isHost) {
            peer.pc.ondatachannel = (event) =>
              this.attachChannel(peerId, event.channel);
          }
        }
        const { pc } = peer;

        // Collision: both sides offered. The polite peer yields.
        const collision =
          peer.makingOffer || pc.signalingState !== "stable";
        if (collision && !peer.polite) {
          // Impolite peer ignores the incoming offer; ours will win.
          return;
        }
        if (collision && peer.polite) {
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch {
            // Older engines: fall through — setRemoteDescription may still work.
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        peer.hasRemoteDescription = true;
        await this.flushCandidates(peer);

        await this.syncLocalTracks(peer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal(peerId, "answer", answer);
        return;
      }

      if (data.type === "answer") {
        if (!peer) return;
        const { pc } = peer;
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        peer.hasRemoteDescription = true;
        await this.flushCandidates(peer);
        return;
      }

      // ICE candidate — may legitimately arrive before the description.
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
      // A candidate that arrives after teardown is expected, not an error.
      if (this.peers.has(peerId)) {
        console.warn("[webrtc] signal handling failed:", err);
      }
    }
  }

  private async flushCandidates(peer: PeerState) {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Stale candidate — the connection will still converge.
      }
    }
  }

  private async sendSignal(
    targetId: string,
    type: SignalMessage["type"],
    payload: unknown
  ) {
    if (this.destroyed) return;
    try {
      const db = requireFirebaseDb();
      const signalsRef = collection(db, "flix_parties", this.roomId, "signals");
      await addDoc(signalsRef, {
        senderId: this.userId,
        targetId,
        type,
        payload: JSON.stringify(payload),
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn("[webrtc] signal send failed:", err);
    }
  }

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
          // Channel closed between the check and the send.
        }
      }
    }
  }

  // ── Teardown ────────────────────────────────────────────────────────

  private closePeer(peerId: string, opts: { keepStream?: boolean } = {}) {
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
    if (!opts.keepStream) this.mediaCallbacks.onRemoteStreamRemoved?.(peerId);

    if (peer) {
      // Stop clones this peer received — they are our allocations, not the
      // sender's tracks, so stopping them is safe and stops the encoder.
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
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
    for (const channel of this.channels.values()) {
      channel.onclose = null;
      try {
        channel.close();
      } catch {
        // already closed
      }
    }
    this.channels.clear();

    // Deliberately does NOT stop `localStream`'s tracks: the stream belongs
    // to the caller (usePartyMedia). Stopping it here killed the user's
    // microphone whenever the transport was rebuilt — e.g. on host handover.
    for (const track of this.clonedTracks) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    this.clonedTracks.clear();
    this.localStream = null;
    this.seenSignals.clear();
    this.seenOrder = [];
  }
}
