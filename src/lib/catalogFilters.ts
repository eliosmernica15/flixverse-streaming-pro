import type { TMDBMovie } from "@/utils/tmdbApi";

export type CatalogYearRange = "all" | "2020s" | "2010s" | "2000s" | "before-2000";

export interface CatalogFilters {
  yearRange: CatalogYearRange;
  genreId: number | null;
}

function parseReleaseDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : null;
}

export function matchesCatalogFilters(
  movie: TMDBMovie,
  filters: CatalogFilters,
  now = new Date()
): boolean {
  if (filters.genreId !== null && !movie.genre_ids?.includes(filters.genreId)) return false;
  if (filters.yearRange === "all") return true;

  const date = movie.release_date || movie.first_air_date;
  if (!date) return false;
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year)) return false;

  switch (filters.yearRange) {
    case "2020s":
      return year >= 2020 && year <= now.getFullYear();
    case "2010s":
      return year >= 2010 && year <= 2019;
    case "2000s":
      return year >= 2000 && year <= 2009;
    case "before-2000":
      return year < 2000;
  }
}

export function releasedWithinDays(movie: TMDBMovie, days: number, now = new Date()): boolean {
  const date = movie.release_date || movie.first_air_date;
  if (!date) return false;
  const release = parseReleaseDate(date);
  if (!release) return false;
  const diff = now.getTime() - release.getTime();
  return diff >= 0 && diff < days * 24 * 60 * 60 * 1000;
}

export function daysUntilRelease(movie: TMDBMovie, now = new Date()): number | null {
  const date = movie.release_date || movie.first_air_date;
  if (!date) return null;
  const release = parseReleaseDate(date);
  if (!release) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = release.getTime() - today.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}
