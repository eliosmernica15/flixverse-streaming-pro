import { describe, expect, it } from "vitest";
import { computeResync, injectSeekParam } from "../embedSeekUrls";

describe("computeResync", () => {
  it("does nothing when drift is below the soft threshold", () => {
    expect(
      computeResync(120, 119.5, "https://vidsrcme.ru/embed/movie/550", "vidsrc")
    ).toEqual({ kind: "none" });
  });

  it("chooses a soft seek for drift within the soft band", () => {
    const action = computeResync(130, 120, "https://vidsrcme.ru/embed/movie/550", "vidsrc");
    expect(action).toEqual({ kind: "soft", deltaSeconds: 10 });
  });

  it("chooses a hard positioned reload beyond the hard threshold", () => {
    const action = computeResync(
      200,
      100,
      "https://vidsrcme.ru/embed/movie/550?autoplay=true",
      "vidsrc"
    );
    expect(action.kind).toBe("hard");
    if (action.kind === "hard") {
      expect(action.seekUrl).toContain("vidsrcme.ru/embed/movie/550");
      expect(action.seekUrl).toContain("t=200");
      expect(action.seekUrl).toContain("autoplay=true");
    }
  });

  it("unwraps legacy /api/embed proxy URLs before injecting seek params", () => {
    const proxied = `https://app.example.com/api/embed?src=${encodeURIComponent(
      "https://vidlink.pro/movie/550"
    )}`;
    const action = computeResync(300, 100, proxied, "vidlink");
    expect(action.kind).toBe("hard");
    if (action.kind === "hard") {
      expect(action.seekUrl).toContain("vidlink.pro/movie/550");
      expect(action.seekUrl).not.toContain("/api/embed");
      expect(action.seekUrl).toContain("#t=300");
    }
  });
});

describe("injectSeekParam", () => {
  it.each([
    ["https://vidsrcme.ru/embed/movie/550", "?t="],
    ["https://vidsrc.to/embed/movie/550", "?t="],
    ["https://vidlink.pro/movie/550", "#t="],
    ["https://player.videasy.to/movie/550", "?progress="],
    ["https://vidfast.pro/movie/550", "?startAt="],
    ["https://yapgrid.com/embed/movie/550", "?start="],
    ["https://unknown-provider.example/embed/movie/550", "?start="],
  ])("injects the documented param for %s", (url, expectedParam) => {
    expect(injectSeekParam(url, 90)).toContain(`${expectedParam}90`);
  });

  it("appends with & when the URL already has a querystring", () => {
    expect(injectSeekParam("https://vidsrcme.ru/embed/movie/550?autoplay=true", 30)).toContain(
      "&t=30"
    );
  });

  it("never produces negative timestamps", () => {
    expect(injectSeekParam("https://vidsrcme.ru/embed/movie/550", -5)).toContain("t=0");
  });

  it("floors fractional seconds", () => {
    expect(injectSeekParam("https://vidsrcme.ru/embed/movie/550", 90.7)).toContain("t=90");
  });
});
