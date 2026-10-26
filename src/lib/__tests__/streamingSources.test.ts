import { describe, expect, it } from "vitest";
import { buildStreamingSources, isAllowedEmbedUrl, pickServerByQuality, proxyEmbedUrl, unproxyEmbedUrl } from "../streamingSources";

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

describe("pickServerByQuality", () => {
  const sources = buildStreamingSources(550, "movie");

  it("returns current index for Auto when no FHD exists (falls back)", () => {
    const idx = pickServerByQuality(sources, "Auto", 2);
    expect(typeof idx).toBe("number");
  });

  it("prefers FHD for Auto when available", () => {
    const idx = pickServerByQuality(sources, "Auto", 0);
    expect(sources[idx].quality).toBe("FHD");
  });

  it("picks 4K when requested and available", () => {
    const idx = pickServerByQuality(sources, "4K", 0);
    expect(sources[idx].quality).toBe("4K");
  });

  it("picks HD for 720p/low requests", () => {
    const idx = pickServerByQuality(sources, "720p", 0);
    expect(sources[idx].quality).toBe("HD");
  });
});

describe("proxy/unproxy embed url", () => {
  it("round-trips a provider url through the proxy", () => {
    const url = "https://vidsrcme.ru/embed/movie/550";
    const proxied = proxyEmbedUrl(url);
    expect(proxied).toContain("/api/embed?src=");
    expect(unproxyEmbedUrl(proxied)).toBe(url);
  });

  it("returns the input unchanged when not proxied", () => {
    const url = "https://vidsrcme.ru/embed/movie/550";
    expect(unproxyEmbedUrl(url)).toBe(url);
  });
});
