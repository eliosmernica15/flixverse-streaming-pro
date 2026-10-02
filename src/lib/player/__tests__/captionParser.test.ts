import { describe, expect, it } from "vitest";
import { getActiveCue, parseSubtitles } from "../captionParser";

const VTT = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
Hello <b>world</b>

2
00:00:04.000 --> 00:00:06.000
Second cue
second line
`;

const SRT = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second cue
`;

describe("parseSubtitles", () => {
  it("returns empty for empty input", () => {
    expect(parseSubtitles("")).toEqual([]);
    expect(parseSubtitles("   \n  ")).toEqual([]);
  });

  it("parses WebVTT cues with tag stripping", () => {
    const cues = parseSubtitles(VTT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, end: 3.5, text: "Hello world" });
    expect(cues[1].start).toBe(4);
    expect(cues[1].end).toBe(6);
    expect(cues[1].text).toBe("Second cue\nsecond line");
  });

  it("parses SRT comma-millisecond timestamps", () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(1);
    expect(cues[0].end).toBe(3.5);
    expect(cues[1].text).toBe("Second cue");
  });

  it("handles CRLF line endings", () => {
    const cues = parseSubtitles(SRT.replace(/\n/g, "\r\n"));
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello world");
  });

  it("skips malformed blocks", () => {
    const malformed = "WEBVTT\n\nno timestamps here\n\n00:00:01.000 --> 00:00:02.000\nfine";
    const cues = parseSubtitles(malformed);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("fine");
  });
});

describe("getActiveCue", () => {
  const cues = parseSubtitles(VTT);

  it("finds the cue covering the time", () => {
    expect(getActiveCue(cues, 2)?.text).toBe("Hello world");
    expect(getActiveCue(cues, 5)?.text).toBe("Second cue\nsecond line");
  });

  it("is exclusive of cue end", () => {
    expect(getActiveCue(cues, 3.5)).toBeNull();
  });

  it("returns null outside all cues", () => {
    expect(getActiveCue(cues, 0)).toBeNull();
    expect(getActiveCue(cues, 100)).toBeNull();
    expect(getActiveCue([], 1)).toBeNull();
  });
});
