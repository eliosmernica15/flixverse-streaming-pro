/**
 * Client-side recommendation engine.
 *
 * Builds a "taste profile" vector from the user's watch history (genre
 * frequency, weighted by recency and rating) and scores candidate titles by
 * cosine similarity. No server or LLM required — runs entirely in the
 * browser, so it works offline and on the free tier.
 *
 * The result is a ranked list with a 0–100 "match" score that the UI can
 * surface as "Picked for you · 87% match".
 */

export interface ScoredItem<T> {
  item: T;
  score: number; // 0–100
  matchLabel: string;
}

/** Build a genre-frequency vector (genre id -> weight) from watch history. */
export function buildTasteProfile(
  history: { genre_ids?: number[]; genres?: { id: number }[]; rating?: number; watchedAt?: number }[],
  now: number = Date.now()
): Map<number, number> {
  const profile = new Map<number, number>();
  if (!history.length) return profile;

  const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
  for (const h of history) {
    const ids = h.genre_ids?.length ? h.genre_ids : (h.genres || []).map((g) => g.id);
    if (!ids.length) continue;
    // Recency weight: 1.0 for just-watched, decaying to 0.3 over 90 days.
    const age = h.watchedAt ? Math.max(0, now - h.watchedAt) : maxAge / 2;
    const recency = Math.max(0.3, 1 - (age / maxAge) * 0.7);
    // Rating weight: 0.5 base + up to 0.5 for a 5-star rating.
    const rating = typeof h.rating === "number" ? h.rating : 3;
    const ratingWeight = 0.5 + (rating / 5) * 0.5;
    const weight = recency * ratingWeight;
    for (const g of ids) {
      profile.set(g, (profile.get(g) || 0) + weight);
    }
  }
  return profile;
}

function magnitude(vec: Map<number, number>): number {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  return Math.sqrt(sum);
}

/** Cosine similarity between two genre vectors (0–1). */
export function cosineSimilarity(a: Map<number, number>, b: Map<number, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv !== undefined) dot += v * bv;
  }
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot / (ma * mb);
}

/** Score a candidate's genre vector against the user profile. */
export function scoreCandidate(
  profile: Map<number, number>,
  candidateGenres: number[]
): number {
  if (profile.size === 0 || candidateGenres.length === 0) return 0;
  const cand = new Map<number, number>();
  for (const g of candidateGenres) cand.set(g, 1);
  const sim = cosineSimilarity(profile, cand);
  return Math.round(sim * 100);
}

/** Rank candidates by score, dropping already-watched ids and zero scores. */
export function rankCandidates<T extends { id: number; genre_ids?: number[] }>(
  profile: Map<number, number>,
  candidates: T[],
  watchedIds: Set<number>,
  limit = 18
): ScoredItem<T>[] {
  const scored: ScoredItem<T>[] = [];
  for (const c of candidates) {
    if (watchedIds.has(c.id)) continue;
    const score = scoreCandidate(profile, c.genre_ids || []);
    if (score <= 0) continue;
    scored.push({ item: c, score, matchLabel: `${score}% match` });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

const recommendations = { buildTasteProfile, cosineSimilarity, scoreCandidate, rankCandidates };
export default recommendations;