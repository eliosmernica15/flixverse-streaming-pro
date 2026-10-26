import { describe, expect, it } from "vitest";
import {
  buildTasteProfile,
  cosineSimilarity,
  scoreCandidate,
  rankCandidates,
} from "../recommendations";

describe("buildTasteProfile", () => {
  it("returns empty map for empty history", () => {
    expect(buildTasteProfile([]).size).toBe(0);
  });

  it("accumulates genre weights", () => {
    const profile = buildTasteProfile([{ genre_ids: [28, 12], rating: 5 }]);
    expect(profile.get(28)).toBeGreaterThan(0);
    expect(profile.get(12)).toBeGreaterThan(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = new Map([[1, 2], [2, 3]]);
    const b = new Map([[1, 2], [2, 3]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("returns 0 for disjoint vectors", () => {
    const a = new Map([[1, 2]]);
    const b = new Map([[2, 3]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for empty", () => {
    expect(cosineSimilarity(new Map(), new Map([[1, 2]]))).toBe(0);
  });
});

describe("scoreCandidate", () => {
  it("returns 0 with empty profile", () => {
    expect(scoreCandidate(new Map(), [28])).toBe(0);
  });

  it("returns higher score for matching genres", () => {
    const profile = buildTasteProfile([{ genre_ids: [28, 12], rating: 5 }]);
    const matching = scoreCandidate(profile, [28, 12]);
    const nonMatching = scoreCandidate(profile, [35]);
    expect(matching).toBeGreaterThan(nonMatching);
  });
});

describe("rankCandidates", () => {
  it("filters watched ids and sorts by score", () => {
    const profile = buildTasteProfile([{ genre_ids: [28], rating: 5 }]);
    const candidates = [
      { id: 1, genre_ids: [28] },
      { id: 2, genre_ids: [28] },
      { id: 3, genre_ids: [35] },
    ];
    const ranked = rankCandidates(profile, candidates, new Set([1]));
    expect(ranked.find((r) => r.item.id === 1)).toBeUndefined();
    expect(ranked[0].item.id).toBe(2);
  });

  it("respects limit", () => {
    const profile = buildTasteProfile([{ genre_ids: [28], rating: 5 }]);
    const candidates = Array.from({ length: 30 }, (_, i) => ({ id: i + 10, genre_ids: [28] }));
    const ranked = rankCandidates(profile, candidates, new Set(), 5);
    expect(ranked.length).toBe(5);
  });
});