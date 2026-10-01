import { describe, expect, it } from "vitest";
import { buildStreamingSources, isAllowedEmbedUrl } from "../streamingSources";

describe("buildStreamingSources", () => {
  const en = buildStreamingSources(550, "movie");

  it("orders vidsrc first and all four yapgrid lanes last", () => {
    expect(en.map((s) => s.id)).toEqual([
      "vidsrc",
      "vidsrc-to",
      "videasy",
      "vidlink",
      "vidfast",
      "yapgrid-g",
      "yapgrid-x",
      "yapgrid-y",
      "yapgrid-z",
    ]);
  });

  it("produces no duplicate source ids", () => {
    const ids = en.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds tv paths with season and episode for every provider", () => {
    const tv = buildStreamingSources(1399, "tv", 1, 2);
    for (const source of tv) {
      expect(source.url).toContain("/tv/1399/1/2");
    }
  });

  it("keeps every provider URL on the allowed embed host list", () => {
    for (const source of en) {
      expect(isAllowedEmbedUrl(source.providerUrl)).toBe(true);
    }
  });

  it("adds Albanian subtitle params only to providers that document them", () => {
    const sq = buildStreamingSources(550, "movie", undefined, undefined, { lang: "sq" });
    expect(sq[0].url).toContain("ds_lang=sq");
    expect(sq.find((s) => s.id === "vidfast")?.url).toContain("sub=sq");
    expect(sq.find((s) => s.id === "vidsrc-to")?.url).not.toContain("sub=");
    expect(sq.every((s) => !s.url.includes("cc="))).toBe(true);
  });
});
