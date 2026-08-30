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

export function isValidAblyApiKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed || /your_ably|placeholder|example|undefined|null/i.test(trimmed)) return false;
  if (trimmed.length < 20) return false;
  // Ably keys are always appId.keyName:secret where secret is base64-ish; require dot + colon
  if (!trimmed.includes(":") || !trimmed.includes(".")) return false;
  // Strict: xxxx.yyyy:zzzz  (key id part + secret)
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+:[A-Za-z0-9+/_=-]{12,}$/.test(trimmed) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+:.{20,}$/.test(trimmed);
}

function getClient(): Ably.Realtime | null {
  const key = process.env.NEXT_PUBLIC_ABLY_API_KEY;
  if (!isValidAblyApiKey(key)) return null;
  if (!_client) {
    try {
      _client = new Ably.Realtime({
        key: key!.trim(),
        autoConnect: true,
        clientId: typeof window !== "undefined"
          ? `user_${Math.random().toString(36).slice(2)}`
          : "ssr",
      });
    } catch {
      _client = null;
      return null;
    }
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
