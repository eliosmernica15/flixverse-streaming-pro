/**
 * Movie similarity scoring for "More like this" suggestions.
 *
 * Scoring (0–100):
 * - Genres: highest weight (primary signal) — require at least one shared genre.
 * - Keywords/themes: medium-high weight (when source keywords available).
 * - Overview text similarity: medium weight (word overlap).
 * - Release year: low weight (proximity bonus).
 * - Vote average/count: low weight (quality filter).
 *
 * Exclusions:
 * - No shared primary genre → drop.
 * - Only a single "generic" genre match (e.g. Drama, Comedy alone) → drop unless overview/year compensate.
 * - Duplicates and the current movie → drop.
 */

import type { TMDBMovie } from '@/utils/tmdbApi';
import {
  type TMDBKeyword,
  fetchMovieKeywords,
  discoverMoviesWithGenresAndKeywords,
  fetchSimilarMovies,
} from '@/utils/tmdbApi';

/** Configurable weights (must sum to 100 for a 0–100 score). */
export const SIMILARITY_WEIGHTS = {
  genre: 40,
  keywords: 25,
  overview: 20,
  releaseYear: 8,
  voteQuality: 7,
} as const;

/** Minimum score (0–100) to include a candidate. */
export const SIMILARITY_THRESHOLD = 25;

/** Genres considered "generic" when they're the only match (require extra signal). */
const GENERIC_GENRE_IDS = new Set([18, 35, 53]); // Drama, Comedy, Thriller

/** Normalize text for overview similarity: lowercase, strip punctuation, unique words. */
function tokenize(text: string): Set<string> {
  if (!text || typeof text !== 'string') return new Set();
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(normalized);
}

/** Jaccard similarity (0–1) between two word sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Genre score 0–1: overlap over max of the two lengths. */
function genreOverlapScore(currentIds: number[], candidateIds: number[]): number {
  if (currentIds.length === 0 || candidateIds.length === 0) return 0;
  const set = new Set(candidateIds);
  let shared = 0;
  for (const id of currentIds) {
    if (set.has(id)) shared++;
  }
  return shared / Math.max(currentIds.length, candidateIds.length);
}

/** Count shared genres and whether the only shared ones are generic. */
function genreMatchInfo(
  currentIds: number[],
  candidateIds: number[]
): { sharedCount: number; onlyGeneric: boolean } {
  const candidateSet = new Set(candidateIds);
  const shared: number[] = [];
  for (const id of currentIds) {
    if (candidateSet.has(id)) shared.push(id);
  }
  const onlyGeneric =
    shared.length === 1 && GENERIC_GENRE_IDS.has(shared[0]);
  return { sharedCount: shared.length, onlyGeneric };
}

/** Release year from movie (movie or TV). */
function releaseYear(m: TMDBMovie): number | null {
  const date = m.release_date || m.first_air_date;
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

/** Year proximity score 0–1: same year = 1, within 1 = 0.6, within 2 = 0.3, else 0. */
function yearScore(currentYear: number | null, candidateYear: number | null): number {
  if (currentYear == null || candidateYear == null) return 0;
  const diff = Math.abs(currentYear - candidateYear);
  if (diff === 0) return 1;
  if (diff === 1) return 0.6;
  if (diff === 2) return 0.3;
  return 0;
}

/** Small quality bonus 0–1 from vote_average and vote_count. */
function voteQualityScore(m: TMDBMovie): number {
  const v = m.vote_average ?? 0;
  const n = (m as { vote_count?: number }).vote_count ?? 0;
  if (n < 50) return 0.3;
  if (v >= 7.5) return 1;
  if (v >= 6.5) return 0.7;
  if (v >= 5.5) return 0.5;
  return 0.2;
}

export interface SimilarityInput {
  current: TMDBMovie;
  candidate: TMDBMovie;
  currentKeywords?: TMDBKeyword[];
  candidateKeywordNames?: Set<string>;
}

/**
 * Compute similarity score 0–100 between current movie and a candidate.
 * Uses weights from SIMILARITY_WEIGHTS.
 */
export function computeSimilarityScore(input: SimilarityInput): number {
  const { current, candidate, currentKeywords = [] } = input;
  const currentGenres = current.genre_ids?.length ? current.genre_ids : [];
  const candidateGenres = candidate.genre_ids?.length ? candidate.genre_ids : [];

  const { sharedCount, onlyGeneric } = genreMatchInfo(currentGenres, candidateGenres);
  if (sharedCount === 0) return 0;

  const genreNorm = genreOverlapScore(currentGenres, candidateGenres);
  const genrePart = (genreNorm * SIMILARITY_WEIGHTS.genre);

  let keywordPart = 0;
  if (currentKeywords.length > 0 && input.candidateKeywordNames?.size) {
    let matches = 0;
    for (const k of currentKeywords) {
      if (input.candidateKeywordNames.has(k.name.toLowerCase())) matches++;
    }
    const keywordOverlap = matches / Math.max(1, currentKeywords.length);
    keywordPart = keywordOverlap * SIMILARITY_WEIGHTS.keywords;
  }

  const overviewA = tokenize(current.overview || '');
  const overviewB = tokenize(candidate.overview || '');
  const overviewSim = jaccard(overviewA, overviewB);
  const overviewPart = overviewSim * SIMILARITY_WEIGHTS.overview;

  const currentYear = releaseYear(current);
  const candidateYear = releaseYear(candidate);
  const yearNorm = yearScore(currentYear, candidateYear);
  const yearPart = yearNorm * SIMILARITY_WEIGHTS.releaseYear;

  const voteNorm = voteQualityScore(candidate);
  const votePart = voteNorm * SIMILARITY_WEIGHTS.voteQuality;

  let total = genrePart + keywordPart + overviewPart + yearPart + votePart;

  if (onlyGeneric && total < 45) {
    total *= 0.6;
  }

  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Whether to exclude candidate: no genre match, or only single generic match with weak other signals.
 */
export function shouldExcludeCandidate(
  current: TMDBMovie,
  candidate: TMDBMovie,
  score: number
): boolean {
  const currentGenres = current.genre_ids ?? [];
  const candidateGenres = candidate.genre_ids ?? [];
  const { sharedCount, onlyGeneric } = genreMatchInfo(currentGenres, candidateGenres);

  if (sharedCount === 0) return true;
  if (onlyGeneric && score < SIMILARITY_THRESHOLD + 15) return true;
  return false;
}

export interface ScoredMovie {
  movie: TMDBMovie;
  score: number;
}

/**
 * Score and filter candidates. Returns sorted by score desc, above threshold.
 */
export function scoreAndFilterCandidates(
  current: TMDBMovie,
  candidates: TMDBMovie[],
  currentKeywords: TMDBKeyword[],
  options: {
    threshold?: number;
    maxResults?: number;
    excludeId?: number;
  } = {}
): ScoredMovie[] {
  const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
  const maxResults = options.maxResults ?? 6;
  const excludeId = options.excludeId ?? current.id;

  const seen = new Set<number>();
  const scored: ScoredMovie[] = [];

  for (const candidate of candidates) {
    if (candidate.id === excludeId || seen.has(candidate.id)) continue;
    seen.add(candidate.id);

    const candidateKeywordNames = new Set(
      (candidate as { keywords?: TMDBKeyword[] }).keywords?.map((k) => k.name.toLowerCase()) ?? []
    );

    const score = computeSimilarityScore({
      current,
      candidate,
      currentKeywords,
      candidateKeywordNames: candidateKeywordNames.size > 0 ? candidateKeywordNames : undefined,
    });

    if (shouldExcludeCandidate(current, candidate, score)) continue;
    if (score < threshold) continue;

    scored.push({ movie: candidate, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Fetch candidate pool and return top similar movies (for movie detail page).
 * Uses discover (genre + keywords) and /similar; scores with genre, overview, year, vote.
 */
export async function getSimilarMoviesForMovie(
  current: TMDBMovie,
  options: { maxResults?: number; threshold?: number } = {}
): Promise<TMDBMovie[]> {
  const maxResults = options.maxResults ?? 4;
  const threshold = options.threshold ?? SIMILARITY_THRESHOLD;

  const [keywords, similar] = await Promise.all([
    fetchMovieKeywords(current.id),
    fetchSimilarMovies(current.id),
  ]);

  const genreIds =
    current.genre_ids && current.genre_ids.length > 0
      ? current.genre_ids
      : (current.genres ?? []).map((g) => g.id);
  const keywordIds = keywords.map((k) => k.id);

  const discoverCandidates =
    genreIds.length > 0
      ? await Promise.all([
          discoverMoviesWithGenresAndKeywords(genreIds, keywordIds, 1),
          discoverMoviesWithGenresAndKeywords(genreIds, [], 2),
        ]).then(([a, b]) => [...a, ...b])
      : [];

  const seen = new Set<number>([current.id]);
  const candidates: TMDBMovie[] = [];
  for (const m of [...discoverCandidates, ...similar]) {
    if (m?.id && !seen.has(m.id)) {
      seen.add(m.id);
      candidates.push(m);
    }
  }

  const scored = scoreAndFilterCandidates(current, candidates, keywords, {
    threshold,
    maxResults,
    excludeId: current.id,
  });

  return scored.map((s) => ({ ...s.movie, media_type: 'movie' }));
}
