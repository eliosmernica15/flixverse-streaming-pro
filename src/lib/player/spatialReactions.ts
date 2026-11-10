/**
 * Floating spatial reactions.
 *
 * Reactions ride the existing party chat transport: a quick-emoji send is
 * already an append-only chat message with `emoji` set, synced to every
 * participant by Firestore (or the Python API). The overlay turns each fresh
 * emoji message into a short-lived particle over the picture — no extra
 * writes, no extra rules, no extra listener.
 *
 * This module is the pure, testable half: which messages become particles
 * and where they float.
 */

export interface ReactionSource {
  id: string;
  senderId: string;
  senderName: string;
  emoji?: string | null;
  createdAt: number;
}

export interface ReactionParticle {
  id: string;
  emoji: string;
  senderName: string;
  /** Horizontal launch point, % of the overlay width. */
  xPercent: number;
  /** Lateral sway amplitude in px (signed). */
  swayPx: number;
  /** Animation duration in ms. */
  durationMs: number;
  /** Size multiplier (0.9 – 1.3). */
  scale: number;
}

/** Messages older than this when first seen are history, not live reactions. */
export const REACTION_FRESH_MS = 8000;
/** Hard cap on simultaneous particles — keeps the overlay cheap. */
export const MAX_ACTIVE_REACTIONS = 12;
/** Per-emoji cap so one spammed reaction cannot fill the screen. */
export const MAX_PER_EMOJI = 3;

/** Deterministic 0…1 hash so a given message always floats the same way. */
function unitHash(input: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Particle geometry for a message. Launch points favour the right-hand side
 * of the picture (where the party rail sits) but spread wide enough that a
 * burst of reactions does not stack on one column.
 */
export function particleFor(message: ReactionSource): ReactionParticle | null {
  const emoji = message.emoji?.trim();
  if (!emoji) return null;
  const a = unitHash(message.id, 1);
  const b = unitHash(message.id, 2);
  const c = unitHash(message.id, 3);
  return {
    id: message.id,
    emoji,
    senderName: message.senderName,
    xPercent: 52 + a * 40,
    swayPx: (b - 0.5) * 48,
    durationMs: 2600 + Math.round(c * 900),
    scale: 0.9 + c * 0.4,
  };
}

/**
 * Pick the messages that should spawn new particles.
 *
 * `seen` is mutated: every inspected id is recorded so history loaded on
 * join (or re-delivered by a snapshot) never animates twice.
 */
export function selectNewReactions(
  messages: readonly ReactionSource[],
  seen: Set<string>,
  now: number,
  freshMs = REACTION_FRESH_MS
): ReactionSource[] {
  const fresh: ReactionSource[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    if (!m.emoji) continue;
    if (now - m.createdAt > freshMs) continue;
    fresh.push(m);
  }
  return fresh;
}

/**
 * Merge new particles into the active list, enforcing the per-emoji and
 * global caps by evicting the oldest first.
 */
export function mergeParticles(
  active: readonly ReactionParticle[],
  incoming: readonly ReactionParticle[],
  maxActive = MAX_ACTIVE_REACTIONS,
  maxPerEmoji = MAX_PER_EMOJI
): ReactionParticle[] {
  let next = [...active];
  for (const p of incoming) {
    const sameEmoji = next.filter((q) => q.emoji === p.emoji);
    if (sameEmoji.length >= maxPerEmoji) {
      const oldest = sameEmoji[0];
      next = next.filter((q) => q.id !== oldest.id);
    }
    next.push(p);
  }
  if (next.length > maxActive) next = next.slice(next.length - maxActive);
  return next;
}
