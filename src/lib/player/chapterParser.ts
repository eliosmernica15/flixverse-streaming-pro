/**
 * Chapter/skip-intro parser for provider postMessage events.
 *
 * Parses provider `PLAYER_EVENT` chapters when a provider sends them.
 * Supports multiple provider formats (Vidsrc, Videasy, VidLink, etc.)
 * and provides skip-intro/recap functionality.
 */

export interface Chapter {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  type: "intro" | "recap" | "chapter" | "credits";
}

export interface ChapterEvent {
  type: "chapters";
  chapters: Chapter[];
  currentChapter?: string;
  timestamp: number;
}

/**
 * Parse chapter data from various provider postMessage formats.
 * Different providers may send chapters in different formats.
 */
export function parseChaptersFromEvent(event: MessageEvent): Chapter[] | null {
  const data = event.data;

  // Handle different event formats from different providers
  // Standard format: { type: "PLAYER_EVENT", event: "chapters", data: [...] }
  if (data?.type === "PLAYER_EVENT" && data.event === "chapters") {
    return normalizeChapters(data.data);
  }

  // Alternative format: { type: "chapters", chapters: [...] }
  if (data?.type === "chapters" && Array.isArray(data.chapters)) {
    return normalizeChapters(data.chapters);
  }

  // Embedded in a generic message: { event: "chapters", payload: [...] }
  if (data?.event === "chapters" && Array.isArray(data.payload)) {
    return normalizeChapters(data.payload);
  }

  // Vidsrc format: { type: "vidsrc:chapters", chapters: [...] }
  if (data?.type === "vidsrc:chapters" && Array.isArray(data.chapters)) {
    return normalizeChapters(data.chapters);
  }

  // Videasy format: { event: "chapters", data: { chapters: [...] } }
  if (data?.event === "chapters" && data.data?.chapters) {
    return normalizeChapters(data.data.chapters);
  }

  return null;
}

/**
 * Normalize chapter data to a consistent format.
 */
function normalizeChapters(chapters: unknown[]): Chapter[] {
  return chapters
    .map((chapter, index) => {
      // Handle different chapter formats
      if (typeof chapter === "object" && chapter !== null) {
        const c = chapter as Record<string, unknown>;

        // Extract timing
        const startTime = parseTime(c.startTime ?? c.start ?? c.start_time ?? c.time);
        const endTime = parseTime(c.endTime ?? c.end ?? c.end_time);

        // Determine chapter type
        const title = String(c.title ?? c.name ?? c.label ?? `Chapter ${index + 1}`);
        const type = inferChapterType(title, index, c.type);

        return {
          id: String(c.id ?? c.id_str ?? `chapter-${index}`),
          title,
          startTime,
          endTime,
          type,
        };
      }
      return null;
    })
    .filter((c): c is Chapter => c !== null);
}

/**
 * Parse time value from various formats (seconds, "HH:MM:SS", "MM:SS", etc.)
 */
function parseTime(value: unknown): number {
  if (typeof value === "number" && isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    // Handle "HH:MM:SS" or "MM:SS"
    const parts = value.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    // Try parsing as plain number
    const num = Number(value);
    if (isFinite(num)) return Math.max(0, num);
  }
  return 0;
}

/**
 * Infer chapter type from title and metadata.
 */
function inferChapterType(title: string, index: number, explicitType?: unknown): "intro" | "recap" | "chapter" | "credits" {
  if (typeof explicitType === "string") {
    const t = explicitType.toLowerCase();
    if (["intro", "opening", "opening_credits"].includes(t)) return "intro";
    if (["recap", "previously"].includes(t)) return "recap";
    if (["credits", "ending_credits", "end_credits"].includes(t)) return "credits";
  }

  const titleLower = title.toLowerCase();
  if (titleLower.includes("intro") || titleLower.includes("opening") || titleLower.includes("opening credits")) {
    return "intro";
  }
  if (titleLower.includes("recap") || titleLower.includes("previously")) {
    return "recap";
  }
  if (titleLower.includes("credit") || titleLower.includes("ending")) {
    return "credits";
  }
  return "chapter";
}

/**
 * Find the intro chapter for skip-intro functionality.
 */
export function findIntroChapter(chapters: Chapter[]): Chapter | null {
  return chapters.find((c) => c.type === "intro") ?? null;
}

/**
 * Find the recap chapter for skip-recap functionality.
 */
export function findRecapChapter(chapters: Chapter[]): Chapter | null {
  return chapters.find((c) => c.type === "recap") ?? null;
}

/**
 * Find the current chapter based on current playback time.
 */
export function getCurrentChapter(chapters: Chapter[], currentTime: number): Chapter | null {
  // Find the chapter that contains the current time
  for (const chapter of chapters) {
    if (currentTime >= chapter.startTime && currentTime < chapter.endTime) {
      return chapter;
    }
  }
  // If past all chapters, return the last one
  if (chapters.length > 0 && currentTime >= chapters[chapters.length - 1].endTime) {
    return chapters[chapters.length - 1];
  }
  return null;
}

/**
 * Get the next chapter after the current time.
 */
export function getNextChapter(chapters: Chapter[], currentTime: number): Chapter | null {
  for (const chapter of chapters) {
    if (chapter.startTime > currentTime) {
      return chapter;
    }
  }
  return null;
}

/**
 * Hook for managing chapters in the player.
 * Listens for chapter events from the embed and provides skip functionality.
 */
export function useChapters() {
  // This would be used in PlayerShell to listen for chapter events
  // and provide skip-intro/recap functionality
  // Implementation would go here
  return {
    chapters: [] as Chapter[],
    currentChapter: null as Chapter | null,
    introChapter: null as Chapter | null,
    recapChapter: null as Chapter | null,
    nextChapter: null as Chapter | null,
    seekToChapter: (chapter: Chapter) => {},
    skipIntro: () => {},
    skipRecap: () => {},
  };
}

export default {
  parseChaptersFromEvent,
  findIntroChapter,
  findRecapChapter,
  getCurrentChapter,
  getNextChapter,
  useChapters,
};