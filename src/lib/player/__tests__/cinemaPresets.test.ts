import { describe, expect, it } from "vitest";
import { moodFromGenres, presetFromGenres, presetForMood, ALL_MOODS } from "../cinemaPresets";

describe("moodFromGenres", () => {
  it("returns neutral for empty/null", () => {
    expect(moodFromGenres(null)).toBe("neutral");
    expect(moodFromGenres([])).toBe("neutral");
  });

  it("maps horror genre to horror mood", () => {
    expect(moodFromGenres([27])).toBe("horror");
  });

  it("maps sci-fi to scifi mood", () => {
    expect(moodFromGenres([878])).toBe("scifi");
  });

  it("prioritizes horror over action", () => {
    expect(moodFromGenres([28, 27])).toBe("horror");
  });

  it("maps drama to drama mood", () => {
    expect(moodFromGenres([18])).toBe("drama");
  });
});

describe("presetFromGenres", () => {
  it("returns a valid preset with multipliers in range", () => {
    const p = presetFromGenres([28]);
    expect(p.bloomMultiplier).toBeGreaterThanOrEqual(0.6);
    expect(p.bloomMultiplier).toBeLessThanOrEqual(1.4);
    expect(p.particleMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(p.cssClass).toMatch(/^mood-/);
  });

  it("presetForMood returns neutral for unknown", () => {
    const p = presetForMood("neutral");
    expect(p.mood).toBe("neutral");
  });
});

describe("ALL_MOODS", () => {
  it("contains 9 moods", () => {
    expect(ALL_MOODS.length).toBe(9);
  });
});