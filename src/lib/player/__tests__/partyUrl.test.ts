import { describe, expect, it } from "vitest";
import { partyLeftStorageKey, stripPartyQueryParams } from "../partyUrl";

describe("stripPartyQueryParams", () => {
  it("removes party/autoplay/server/guest params", () => {
    const params = new URLSearchParams(
      "party=room1&autoplay=true&server=2&guest=1&type=movie&season=1"
    );
    const next = stripPartyQueryParams(params);
    expect(next.has("party")).toBe(false);
    expect(next.has("autoplay")).toBe(false);
    expect(next.has("server")).toBe(false);
    expect(next.has("guest")).toBe(false);
  });

  it("keeps non-party params", () => {
    const params = new URLSearchParams("type=tv&season=2&episode=3&lang=sq");
    const next = stripPartyQueryParams(params);
    expect(next.get("type")).toBe("tv");
    expect(next.get("season")).toBe("2");
    expect(next.get("episode")).toBe("3");
    expect(next.get("lang")).toBe("sq");
  });

  it("does not mutate the input params object", () => {
    const params = new URLSearchParams("party=room1&type=movie");
    stripPartyQueryParams(params);
    expect(params.has("party")).toBe(true);
  });

  it("returns an empty param set when only party params exist", () => {
    const next = stripPartyQueryParams(new URLSearchParams("party=room1"));
    expect([...next.keys()]).toEqual([]);
  });
});

describe("partyLeftStorageKey", () => {
  it("namespaces by room id", () => {
    expect(partyLeftStorageKey("abc123")).toBe("flixverse-left-party-abc123");
  });
});
