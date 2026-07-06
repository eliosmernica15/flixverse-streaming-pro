import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
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

  constructor(
    roomId: string,
    userId: string,
    peerConnection: RTCPeerConnection,
    onMessage: (msg: any) => void
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.peerConnection = peerConnection;

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = (e) => onMessage(JSON.parse(e.data));
    };
  }

  async createRoom() {
    const db = requireFirebaseDb();
    const roomRef = doc(db, "flixparty_rooms", this.roomId);
    await setDoc(roomRef, { hostId: this.userId, createdAt: Date.now() });

    this.dataChannel = this.peerConnection.createDataChannel("sync");
    // We would attach onmessage here, but we pass it via callback to the hook
  }

  async joinRoom() {
    // Basic join logic - real implementation would handle multi-peer
  }

  listenForSignals() {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flixparty_rooms", this.roomId, "signals");
    
    this.unsubscribe = onSnapshot(query(signalsRef, where("senderId", "!=", this.userId)), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data() as SignalMessage;
          const payload = JSON.parse(data.payload);

          if (data.type === "offer") {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.sendSignal("answer", answer);
          } else if (data.type === "answer") {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
          } else if (data.type === "candidate") {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload));
          }
        }
      });
    });
  }

  async sendSignal(type: "offer" | "answer" | "candidate", payload: any) {
    const db = requireFirebaseDb();
    const signalsRef = collection(db, "flixparty_rooms", this.roomId, "signals");
    await addDoc(signalsRef, {
      senderId: this.userId,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    });
  }

  sendMessage(message: any) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.peerConnection.close();
  }
}
