export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

/** Parse WebVTT or SRT subtitle text into timed cues. */
export function parseSubtitles(raw: string): CaptionCue[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // WebVTT
  if (normalized.startsWith("WEBVTT")) {
    return parseVtt(normalized);
  }

  // SRT
  return parseSrt(normalized);
}

function parseTimestamp(ts: string): number {
  const parts = ts.trim().replace(",", ".").split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m, 10) * 60 + parseFloat(s);
  }
  return 0;
}

function parseVtt(text: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() && !l.startsWith("WEBVTT") && !l.startsWith("NOTE"));
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim().split(" ")[0]);
    const textLines = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()));
    if (!textLines.length) continue;
    cues.push({
      start: parseTimestamp(startStr),
      end: parseTimestamp(endStr),
      text: textLines.join("\n").replace(/<[^>]+>/g, ""),
    });
  }
  return cues;
}

function parseSrt(text: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 3) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
    const textLines = lines.filter((l) => l !== lines[0] && l !== timeLine);
    if (!textLines.length) continue;
    cues.push({
      start: parseTimestamp(startStr),
      end: parseTimestamp(endStr),
      text: textLines.join("\n").replace(/<[^>]+>/g, ""),
    });
  }
  return cues;
}

/** Find the active cue for a given playback time. */
export function getActiveCue(cues: CaptionCue[], time: number): CaptionCue | null {
  return cues.find((c) => time >= c.start && time < c.end) ?? null;
}
