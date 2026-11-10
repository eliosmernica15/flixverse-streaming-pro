import { describe, expect, it, vi } from "vitest";
import {
  buildPartyPlayerUrl,
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  isRoomEncryptionRotationDue,
  partyContentMatches,
  type PartyPayload,
} from "../roomEncryption";

const PAYLOAD: PartyPayload = {
  tmdbId: 550,
  mediaType: "movie",
  serverIndex: 0,
};

async function encryptLegacyPayload(payload: PartyPayload, roomKey: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(roomKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("flixverse-party"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

describe("generateRoomKey", () => {
  it("produces a 24-character key from the URL-safe alphabet", () => {
    const key = generateRoomKey();
    expect(key).toMatch(/^[A-HJ-NP-Z2-9]{24}$/);
  });

  it("is randomized (two calls differ with overwhelming probability)", () => {
    expect(generateRoomKey()).not.toBe(generateRoomKey());
  });
});

describe("encryptPayload / decryptPayload", () => {
  it("roundtrips a payload through the room key", async () => {
    const key = generateRoomKey();
    const encrypted = await encryptPayload(PAYLOAD, key);
    expect(encrypted).toBeTruthy();

    const decrypted = await decryptPayload(encrypted, key);
    expect(decrypted).toEqual(PAYLOAD);
  });

  it("roundtrips tv payloads with season/episode", async () => {
    const key = generateRoomKey();
    const payload: PartyPayload = { tmdbId: 1399, mediaType: "tv", season: 2, episode: 5, serverIndex: 0 };
    const decrypted = await decryptPayload(await encryptPayload(payload, key), key);
    expect(decrypted).toEqual(payload);
  });

  it("returns null when decrypted with the wrong key", async () => {
    const encrypted = await encryptPayload(PAYLOAD, generateRoomKey());
    const decrypted = await decryptPayload(encrypted, generateRoomKey());
    expect(decrypted).toBeNull();
  });

  it("returns null for malformed ciphertext", async () => {
    expect(await decryptPayload("not-base64!!", generateRoomKey())).toBeNull();
    expect(await decryptPayload(btoa("garbage"), generateRoomKey())).toBeNull();
    expect(await decryptPayload("fv2:not-an-epoch:bad:payload", generateRoomKey())).toBeNull();
  });

  it("decrypts ciphertext from the legacy room-key format", async () => {
    const key = generateRoomKey();
    const encrypted = await encryptLegacyPayload(PAYLOAD, key);
    await expect(decryptPayload(encrypted, key)).resolves.toEqual(PAYLOAD);
  });

  it("rotates the derived encryption key every hour", async () => {
    const issuedAt = Math.ceil(1_700_000_000_000 / 3_600_000) * 3_600_000;
    const ciphertext = await encryptPayload(PAYLOAD, generateRoomKey(), issuedAt);

    expect(isRoomEncryptionRotationDue(ciphertext, issuedAt + 59 * 60 * 1000)).toBe(false);
    expect(isRoomEncryptionRotationDue(ciphertext, issuedAt + 60 * 60 * 1000)).toBe(true);
  });

  it("expires rotated ciphertext after its renewal window", async () => {
    vi.useFakeTimers();
    const issuedAt = 1_700_000_000_000;
    const key = generateRoomKey();
    vi.setSystemTime(issuedAt);
    try {
      const ciphertext = await encryptPayload(PAYLOAD, key, issuedAt);
      vi.setSystemTime(issuedAt + 66 * 60 * 1000);
      await expect(decryptPayload(ciphertext, key)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("buildPartyPlayerUrl", () => {
  it("points at the content with party + autoplay params", () => {
    const url = buildPartyPlayerUrl("room1", PAYLOAD);
    expect(url).toBe("/movie/550?type=movie&party=room1&autoplay=true");
  });

  it("omits the server param when serverIndex is 0", () => {
    const url = buildPartyPlayerUrl("room1", { ...PAYLOAD, serverIndex: 0 });
    expect(url).not.toContain("server=");
  });

  it("includes season/episode for tv", () => {
    const url = buildPartyPlayerUrl("room1", {
      tmdbId: 1399,
      mediaType: "tv",
      season: 2,
      episode: 7,
      serverIndex: 3,
    });
    expect(url).toBe("/movie/1399?type=tv&party=room1&season=2&episode=7&server=3&autoplay=true");
  });
});

describe("partyContentMatches", () => {
  it("matches movie id + type regardless of season/episode", () => {
    expect(partyContentMatches(PAYLOAD, 550, "movie")).toBe(true);
    expect(partyContentMatches(PAYLOAD, 550, "movie", 9, 9)).toBe(true);
  });

  it("rejects a different movie or type", () => {
    expect(partyContentMatches(PAYLOAD, 551, "movie")).toBe(false);
    expect(partyContentMatches(PAYLOAD, 550, "tv")).toBe(false);
  });

  it("requires the same season/episode for tv", () => {
    const tv: PartyPayload = { tmdbId: 1399, mediaType: "tv", season: 1, episode: 2, serverIndex: 0 };
    expect(partyContentMatches(tv, 1399, "tv", 1, 2)).toBe(true);
    expect(partyContentMatches(tv, 1399, "tv", 1, 3)).toBe(false);
    expect(partyContentMatches(tv, 1399, "tv", 2, 2)).toBe(false);
  });

  it("defaults missing season/episode to 1 on both sides", () => {
    const tv: PartyPayload = { tmdbId: 1399, mediaType: "tv", serverIndex: 0 };
    expect(partyContentMatches(tv, 1399, "tv")).toBe(true);
    expect(partyContentMatches(tv, 1399, "tv", 1, 1)).toBe(true);
  });
});
