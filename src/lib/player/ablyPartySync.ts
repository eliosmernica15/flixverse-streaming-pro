/**
 * Ably-powered real-time party sync.
 *
 * Replaces the WebRTC data channel layer. Each party room gets its own
 * Ably channel named `party:<roomId>`. The host publishes play/pause/seek/
 * heartbeat events; guests subscribe and apply them.
 *
 * Anti-loop guarantee: every message carries the publisher's Ably connectionId.
 * Recipients skip messages whose connectionId matches their own.
 */

import Ably from "ably";

export type PartySyncEventType =
  | "play"
  | "pause"
  | "seek"
  | "heartbeat"
  | "speaking";

export interface PartySyncMessage {
  type: PartySyncEventType;
  connectionId: string;
  data: {
    currentTime?: number;
    speaking?: boolean;
    [key: string]: unknown;
  };
  timestamp: number;
}

type MessageHandler = (msg: PartySyncMessage) => void;

let _client: Ably.Realtime | null = null;

function getClient(): Ably.Realtime | null {
  const key = process.env.NEXT_PUBLIC_ABLY_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new Ably.Realtime({
      key,
      autoConnect: true,
      // Use client-side auth so the key isn't exposed in messages
      clientId: typeof window !== "undefined"
        ? `user_${Math.random().toString(36).slice(2)}`
        : "ssr",
    });
  }
  return _client;
}

export class AblyPartyChannel {
  private channel: Ably.RealtimeChannel | null = null;
  private roomId: string;
  private onMessage: MessageHandler;
  private _connectionId = "";
  private destroyed = false;

  constructor(roomId: string, onMessage: MessageHandler) {
    this.roomId = roomId;
    this.onMessage = onMessage;
    this.init();
  }

  private init() {
    const client = getClient();
    if (!client) {
      console.warn("[AblyPartySync] NEXT_PUBLIC_ABLY_API_KEY not set — sync disabled");
      return;
    }

    // Store connectionId once connected
    client.connection.on("connected", () => {
      this._connectionId = client.connection.id ?? "";
    });
    if (client.connection.id) {
      this._connectionId = client.connection.id;
    }

    this.channel = client.channels.get(`party:${this.roomId}`);

    this.channel.subscribe((msg) => {
      if (this.destroyed) return;
      try {
        const payload = (typeof msg.data === "string"
          ? JSON.parse(msg.data)
          : msg.data) as PartySyncMessage;

        // Anti-loop: ignore our own messages
        if (payload.connectionId && payload.connectionId === this._connectionId) return;

        this.onMessage(payload);
      } catch {
        // malformed message — ignore
      }
    });
  }

  publish(type: PartySyncEventType, data: PartySyncMessage["data"]) {
    if (!this.channel || this.destroyed) return;
    const msg: PartySyncMessage = {
      type,
      connectionId: this._connectionId,
      data,
      timestamp: Date.now(),
    };
    this.channel.publish("sync", msg).catch(() => {/* ignore publish errors */});
  }

  get isConnected(): boolean {
    const client = getClient();
    if (!client) return false;
    return client.connection.state === "connected";
  }

  destroy() {
    this.destroyed = true;
    this.channel?.unsubscribe();
    this.channel = null;
  }
}
