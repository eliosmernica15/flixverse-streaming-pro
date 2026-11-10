import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_REACTIONS,
  MAX_PER_EMOJI,
  mergeParticles,
  particleFor,
  selectNewReactions,
  type ReactionParticle,
  type ReactionSource,
} from "../spatialReactions";

const msg = (id: string, emoji: string | null, createdAt: number): ReactionSource => ({
  id,
  senderId: "u1",
  senderName: "Ana",
  emoji,
  createdAt,
});

describe("spatialReactions", () => {
  it("ignores text messages and stale history, and never repeats an id", () => {
    const seen = new Set<string>();
    const now = 100_000;
    const first = selectNewReactions(
      [msg("a", "🔥", now - 1000), msg("b", null, now), msg("c", "😂", now - 60_000)],
      seen,
      now
    );
    expect(first.map((m) => m.id)).toEqual(["a"]);
    expect(seen.has("b") && seen.has("c")).toBe(true);
    expect(selectNewReactions([msg("a", "🔥", now)], seen, now)).toEqual([]);
  });

  it("produces deterministic, in-bounds particle geometry", () => {
    const p1 = particleFor(msg("same-id", "🔥", 0));
    const p2 = particleFor(msg("same-id", "🔥", 0));
    expect(p1).toEqual(p2);
    expect(p1!.xPercent).toBeGreaterThanOrEqual(52);
    expect(p1!.xPercent).toBeLessThanOrEqual(92);
    expect(particleFor(msg("x", "  ", 0))).toBeNull();
  });

  it("caps particles per emoji and globally, evicting the oldest", () => {
    const mk = (id: string, emoji: string): ReactionParticle => ({
      id,
      emoji,
      senderName: "",
      xPercent: 60,
      swayPx: 0,
      durationMs: 3000,
      scale: 1,
    });
    let active: ReactionParticle[] = [];
    for (let i = 0; i < MAX_PER_EMOJI + 2; i += 1) {
      active = mergeParticles(active, [mk(`f${i}`, "🔥")]);
    }
    expect(active.filter((p) => p.emoji === "🔥")).toHaveLength(MAX_PER_EMOJI);
    expect(active[0].id).toBe(`f2`);

    const many = Array.from({ length: MAX_ACTIVE_REACTIONS + 5 }, (_, i) => mk(`m${i}`, `e${i}`));
    const capped = mergeParticles([], many);
    expect(capped).toHaveLength(MAX_ACTIVE_REACTIONS);
    expect(capped.at(-1)!.id).toBe(`m${MAX_ACTIVE_REACTIONS + 4}`);
  });
});
