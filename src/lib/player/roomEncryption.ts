/**
 * Web Crypto encryption for FlixParty room payloads.
 * Room key lives in the URL hash fragment (never sent to server).
 * Encrypted payload stored in Firestore — only room members can decrypt.
 */

const ALGO: AesGcmParams = { name: "AES-GCM", iv: new Uint8Array(12) };

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("flixverse-party"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface PartyPayload {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  serverIndex: number;
}

/**
 * Generate a random 6-character room key (URL-safe).
 */
export function generateRoomKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  const rand = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) key += chars[rand[i] % chars.length];
  return key;
}

/**
 * Encrypt a party payload with the room key.
 * Returns a base64 string safe to store in Firestore.
 */
export async function encryptPayload(
  payload: PartyPayload,
  roomKey: string
): Promise<string> {
  const key = await deriveKey(roomKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bufToBase64(combined.buffer);
}

/**
 * Decrypt an encrypted payload with the room key.
 */
export async function decryptPayload(
  encryptedBase64: string,
  roomKey: string
): Promise<PartyPayload | null> {
  try {
    const key = await deriveKey(roomKey);
    const combined = new Uint8Array(base64ToBuf(encryptedBase64));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const json = new TextDecoder().decode(plainBuf);
    return JSON.parse(json) as PartyPayload;
  } catch {
    return null;
  }
}

/**
 * Build a party join URL with the room key in the hash fragment.
 * Hash fragments are never sent to the server — keeps the key private.
 */
export function buildPartyJoinUrl(roomId: string, roomKey: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/party/join?id=${roomId}#key=${roomKey}`;
}

/**
 * Extract the room key from the current URL hash fragment.
 */
export function extractRoomKeyFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/#key=([A-Z0-9]{6})/);
  return match?.[1] ?? null;
}
