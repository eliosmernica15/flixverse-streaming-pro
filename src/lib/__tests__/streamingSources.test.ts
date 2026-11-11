import { describe, expect, it } from "vitest";
import { buildStreamingSources, isAllowedEmbedUrl, pickServerByQuality, ALLOWED_EMBED_HOSTS, unproxyEmbedUrl } from "../streamingSources";

describe("buildStreamingSources", () => {
  const en = buildStreamingSources(550, "movie");

  it("orders vidsrc first and all four yapgrid lanes last", () => {
    expect(en.map((s) => s.id)).toEqual([
      "vidsrc",
      "vidlink",
      "vidfast",
      "videasy",
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

  it("allows documented VidFast mirrors and rejects lookalike domains", () => {
    expect(isAllowedEmbedUrl("https://player.vidfast.vc/embed")).toBe(true);
    expect(isAllowedEmbedUrl("https://vidsrc.to.attacker.example/embed")).toBe(false);
    expect(isAllowedEmbedUrl("http://vidsrc.to/embed")).toBe(true);
  });

  it("uses a canonical host list shared with the CSP configuration", () => {
    expect(ALLOWED_EMBED_HOSTS).toContain("vidfast.vc");
    expect(ALLOWED_EMBED_HOSTS).toContain("player.videasy.to");
  });

  it("adds Albanian subtitle params only to providers that document them", () => {
    const sq = buildStreamingSources(550, "movie", undefined, undefined, { lang: "sq" });
    expect(sq.find((s) => s.id === "vidsrc")?.url).toContain("ds_lang=sq");
    expect(sq.find((s) => s.id === "vidfast")?.url).toContain("sub=sq");
    expect(sq.find((s) => s.id === "vidlink")?.url).not.toContain("sub=");
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

  it("falls back to the best available quality when 4K is requested but no 4K source exists", () => {
    const idx = pickServerByQuality(sources, "4K", 0);
    expect(sources[idx].quality).toBe("FHD");
  });

  it("picks HD for 720p/low requests", () => {
    const idx = pickServerByQuality(sources, "720p", 0);
    expect(sources[idx].quality).toBe("HD");
  });
});

describe("legacy embed proxy URL compatibility", () => {
  it("returns the input unchanged when not proxied", () => {
    const url = "https://vidsrc.to/embed/movie/550";
    expect(unproxyEmbedUrl(url)).toBe(url);
  });

  it("unwraps links issued by the removed embed proxy", () => {
    const url = "https://vidsrc.to/embed/movie/550";
    expect(unproxyEmbedUrl(`/api/embed?src=${encodeURIComponent(url)}`)).toBe(url);
  });
});
