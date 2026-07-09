import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";

export interface SignalMessage {
  senderId: string;
  type: "offer" | "answer" | "candidate";
  payload: string;
  createdAt: number;
}

export class WebRTCSignaling {
  private roomId: string;
  private userId: string;
  private peerConnection: RTCPeerConnection;
  private unsubscribe: (() => void) | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessage: (msg: unknown) => void;
  private isHost: boolean;

  constructor(
    roomId: string,
    userId: string,
    peerConnection: RTCPeerConnection,
    onMessage: (msg: unknown) => void,
    isHost = false
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.peerConnection = peerConnection;
    this.onMessage = onMessage;
    this.isHost = isHost;

    this.peerConnection.ondatachannel = (event) => {
      this.attachDataChannel(event.channel);
    };
  }

  private attachDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string));
      } catch {
        // ignore malformed messages
      }
    };
  }

  async initAsHost() {
    this.dataChannel = this.peerConnection.createDataChannel("sync");
    this.attachDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.sendSignal("offer", offer);
  }

  listenForSignals() {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flix_parties", this.roomId, "signals");

    this.unsubscribe = onSnapshot(
      query(signalsRef, where("senderId", "!=", this.userId)),
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;
          const data = change.doc.data() as SignalMessage;
          const payload = JSON.parse(data.payload);

          try {
            if (data.type === "offer" && !this.isHost) {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
              const answer = await this.peerConnection.createAnswer();
              await this.peerConnection.setLocalDescription(answer);
              await this.sendSignal("answer", answer);
            } else if (data.type === "answer" && this.isHost) {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
            } else if (data.type === "candidate") {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload));
            }
          } catch (err) {
            console.warn("WebRTC signal handling failed:", err);
          }
        });
      }
    );
  }

  async sendSignal(type: "offer" | "answer" | "candidate", payload: unknown) {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flix_parties", this.roomId, "signals");
    await addDoc(signalsRef, {
      senderId: this.userId,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    });
  }

  sendMessage(message: unknown) {
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.dataChannel?.close();
    this.peerConnection.close();
  }
}
