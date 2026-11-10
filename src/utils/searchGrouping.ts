/**
 * Pure helpers that turn raw TMDB search payloads into the grouped, deduplicated
 * rows the hero command palette renders.
 *
 * Deliberately dependency-free (no React, no `@/utils/tmdbApi` import) so the
 * logic stays unit-testable in the repo's node-only vitest environment.
 */

export type SearchKind = "movie" | "tv" | "person";

/** Maximum number of rows rendered per result group. */
export const MAX_PER_GROUP = 5;

/** Minimum query length before TMDB is queried. */
export const MIN_QUERY_LENGTH = 2;

/** Structural subset of the TMDB payloads this module cares about. */
export interface RawSearchItem {
  id?: number | null;
  media_type?: string | null;
  title?: string | null;
  name?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  known_for_department?: string | null;
}

export interface SearchEntry {
  /** `${kind}-${id}` — unique per result, doubles as the cmdk item value. */
  key: string;
  id: number;
  kind: SearchKind;
  title: string;
  posterPath: string | null;
  profilePath: string | null;
  voteAverage: number;
  year: number | null;
  department: string | null;
}

export interface GroupedSearchResults {
  movies: SearchEntry[];
  tvShows: SearchEntry[];
  people: SearchEntry[];
}

/** `/search/multi` omits `media_type` in a few payload shapes; infer from the title. */
export function resolveKind(item: RawSearchItem): SearchKind {
  if (item.media_type === "movie" || item.media_type === "tv" || item.media_type === "person") {
    return item.media_type;
  }
  return item.title ? "movie" : "tv";
}

/** TMDB dates are `YYYY-MM-DD`; anything else yields null rather than NaN. */
export function releaseYear(item: RawSearchItem): number | null {
  const raw = item.release_date || item.first_air_date || "";
  const year = Number.parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(year) && year > 1800 ? year : null;
}

export function isSearchableQuery(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

function toEntry(item: RawSearchItem, kind: SearchKind): SearchEntry | null {
  if (typeof item.id !== "number" || !Number.isFinite(item.id)) return null;

  const title = (kind === "person" ? item.name || item.title : item.title || item.name)?.trim();
  if (!title) return null;

  return {
    key: `${kind}-${item.id}`,
    id: item.id,
    kind,
    title,
    posterPath: item.poster_path ?? null,
    profilePath: item.profile_path ?? null,
    voteAverage: typeof item.vote_average === "number" ? item.vote_average : 0,
    year: kind === "person" ? null : releaseYear(item),
    department: item.known_for_department ?? null,
  };
}

/**
 * Merge `/search/multi` and `/search/people` payloads into one ordered list.
 *
 * `/search/multi` already returns people, so the two payloads overlap — dedupe by
 * kind+id while keeping the first (most relevant) occurrence, and preserve the
 * order TMDB returned so relevance ranking survives.
 */
export function normalizeSearchResults(
  multi: RawSearchItem[] = [],
  people: RawSearchItem[] = [],
): SearchEntry[] {
  const seen = new Set<string>();
  const entries: SearchEntry[] = [];

  const push = (item: RawSearchItem, kind: SearchKind) => {
    const entry = toEntry(item, kind);
    if (!entry || seen.has(entry.key)) return;
    seen.add(entry.key);
    entries.push(entry);
  };

  for (const item of multi) push(item, resolveKind(item));
  for (const item of people) push(item, "person");

  return entries;
}

export function groupSearchResults(entries: SearchEntry[]): GroupedSearchResults {
  const grouped: GroupedSearchResults = { movies: [], tvShows: [], people: [] };

  for (const entry of entries) {
    if (entry.kind === "movie") grouped.movies.push(entry);
    else if (entry.kind === "tv") grouped.tvShows.push(entry);
    else grouped.people.push(entry);
  }

  return grouped;
}

export function entryHref(entry: SearchEntry): string {
  return entry.kind === "person" ? `/person/${entry.id}` : `/movie/${entry.id}?type=${entry.kind}`;
}
