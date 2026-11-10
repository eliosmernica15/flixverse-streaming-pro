import { describe, expect, it } from "vitest";
import {
  daysUntilRelease,
  matchesCatalogFilters,
  releasedWithinDays,
} from "../catalogFilters";
import type { TMDBMovie } from "@/utils/tmdbApi";

const movie = (release_date: string, genre_ids = [28]): TMDBMovie => ({
  id: 1,
  title: "Test",
  overview: "",
  poster_path: "/poster.jpg",
  backdrop_path: "",
  vote_average: 7,
  release_date,
  genre_ids,
});

describe("catalogFilters", () => {
  const now = new Date("2026-11-03T12:00:00");

  it("filters by decade and genre", () => {
    expect(matchesCatalogFilters(movie("2024-01-01"), { yearRange: "2020s", genreId: 28 }, now)).toBe(true);
    expect(matchesCatalogFilters(movie("2024-01-01", [35]), { yearRange: "2020s", genreId: 28 }, now)).toBe(false);
    expect(matchesCatalogFilters(movie("2018-01-01"), { yearRange: "2020s", genreId: null }, now)).toBe(false);
  });

  it("finds content released within the selected recent window", () => {
    expect(releasedWithinDays(movie("2026-11-01"), 7, now)).toBe(true);
    expect(releasedWithinDays(movie("2026-10-20"), 7, now)).toBe(false);
    expect(releasedWithinDays(movie("2026-11-05"), 7, now)).toBe(false);
  });

  it("computes a calendar-day release countdown", () => {
    expect(daysUntilRelease(movie("2026-11-06"), now)).toBe(3);
    expect(daysUntilRelease(movie("2026-11-03"), now)).toBe(0);
    expect(daysUntilRelease(movie("2026-11-01"), now)).toBe(-2);
    expect(daysUntilRelease(movie("2026-02-31"), now)).toBeNull();
  });
});
