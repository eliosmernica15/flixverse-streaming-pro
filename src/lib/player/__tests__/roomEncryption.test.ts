import { describe, expect, it } from "vitest";
import {
  buildPartyPlayerUrl,
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  partyContentMatches,
  type PartyPayload,
} from "../roomEncryption";

const PAYLOAD: PartyPayload = {
  tmdbId: 550,
  mediaType: "movie",
  serverIndex: 0,
};

describe("generateRoomKey", () => {
  it("produces a 6-character key from the URL-safe alphabet", () => {
    const key = generateRoomKey();
    expect(key).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
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
