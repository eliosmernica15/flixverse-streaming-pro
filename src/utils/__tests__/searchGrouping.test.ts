import { describe, expect, it } from "vitest";

import {
  entryHref,
  groupSearchResults,
  isSearchableQuery,
  normalizeSearchResults,
  releaseYear,
  resolveKind,
  type RawSearchItem,
} from "../searchGrouping";

describe("resolveKind", () => {
  it("honours an explicit media_type", () => {
    expect(resolveKind({ media_type: "movie", name: "Dune" })).toBe("movie");
    expect(resolveKind({ media_type: "tv", title: "Severance" })).toBe("tv");
    expect(resolveKind({ media_type: "person", name: "Zendaya" })).toBe("person");
  });

  it("infers from the payload shape when media_type is missing", () => {
    expect(resolveKind({ title: "Arrival" })).toBe("movie");
    expect(resolveKind({ name: "Severance" })).toBe("tv");
    expect(resolveKind({ media_type: null, title: "Arrival" })).toBe("movie");
  });
});

describe("releaseYear", () => {
  it("reads the year from either date field", () => {
    expect(releaseYear({ release_date: "2021-10-22" })).toBe(2021);
    expect(releaseYear({ first_air_date: "2019-02-15" })).toBe(2019);
  });

  it("returns null for missing or unusable dates", () => {
    expect(releaseYear({})).toBeNull();
    expect(releaseYear({ release_date: "" })).toBeNull();
    expect(releaseYear({ release_date: "not-a-date" })).toBeNull();
    expect(releaseYear({ release_date: "1200-01-01" })).toBeNull();
  });
});

describe("isSearchableQuery", () => {
  it("requires two non-whitespace characters", () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery("a")).toBe(false);
    expect(isSearchableQuery("  a  ")).toBe(false);
    expect(isSearchableQuery("ab")).toBe(true);
    expect(isSearchableQuery("  dune ")).toBe(true);
  });
});

describe("normalizeSearchResults", () => {
  it("splits nothing when both payloads are empty", () => {
    expect(normalizeSearchResults()).toEqual([]);
    expect(normalizeSearchResults([], [])).toEqual([]);
  });

  it("preserves TMDB relevance order", () => {
    const multi: RawSearchItem[] = [
      { id: 1, media_type: "movie", title: "First" },
      { id: 2, media_type: "movie", title: "Second" },
      { id: 3, media_type: "tv", name: "Third" },
    ];

    expect(normalizeSearchResults(multi).map((entry) => entry.title)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("deduplicates people returned by both endpoints", () => {
    const multi: RawSearchItem[] = [
      { id: 31, media_type: "person", name: "Tom Holland" },
      { id: 9, media_type: "movie", title: "Uncharted" },
    ];
    const people: RawSearchItem[] = [
      { id: 31, media_type: "person", name: "Tom Holland" },
      { id: 44, media_type: "person", name: "Mark Wahlberg" },
    ];

    const entries = normalizeSearchResults(multi, people);

    expect(entries.map((entry) => entry.key)).toEqual(["person-31", "movie-9", "person-44"]);
  });

  it("drops entries with no id or no usable title", () => {
    const multi: RawSearchItem[] = [
      { title: "No id" },
      { id: 7, media_type: "movie", title: "   " },
      { id: 8, media_type: "movie", title: "Kept" },
    ];

    expect(normalizeSearchResults(multi).map((entry) => entry.title)).toEqual(["Kept"]);
  });

  it("normalizes person rows for the profile-image path and skips their year", () => {
    const [person] = normalizeSearchResults([
      {
        id: 5,
        media_type: "person",
        name: "Ana de Armas",
        profile_path: "/ana.jpg",
        known_for_department: "Acting",
        release_date: "1999-01-01",
      },
    ]);

    expect(person).toMatchObject({
      key: "person-5",
      kind: "person",
      title: "Ana de Armas",
      profilePath: "/ana.jpg",
      department: "Acting",
      year: null,
      voteAverage: 0,
    });
  });

  it("coerces a missing vote_average to zero", () => {
    const [movie] = normalizeSearchResults([
      { id: 1, media_type: "movie", title: "No score", vote_average: null },
    ]);

    expect(movie.voteAverage).toBe(0);
  });
});

describe("groupSearchResults", () => {
  it("splits entries into movies, tv shows and people", () => {
    const entries = normalizeSearchResults([
      { id: 1, media_type: "movie", title: "A Movie" },
      { id: 2, media_type: "tv", name: "A Show" },
      { id: 3, media_type: "person", name: "An Actor" },
      { id: 4, media_type: "movie", title: "Another Movie" },
    ]);

    const grouped = groupSearchResults(entries);

    expect(grouped.movies.map((entry) => entry.title)).toEqual(["A Movie", "Another Movie"]);
    expect(grouped.tvShows.map((entry) => entry.title)).toEqual(["A Show"]);
    expect(grouped.people.map((entry) => entry.title)).toEqual(["An Actor"]);
  });

  it("returns empty groups for an empty list", () => {
    expect(groupSearchResults([])).toEqual({ movies: [], tvShows: [], people: [] });
  });
});

describe("entryHref", () => {
  it("routes people to their profile and titles to the watch page with a type hint", () => {
    const [movie, show, person] = normalizeSearchResults([
      { id: 11, media_type: "movie", title: "Dune" },
      { id: 22, media_type: "tv", name: "Severance" },
      { id: 33, media_type: "person", name: "Zendaya" },
    ]);

    expect(entryHref(movie)).toBe("/movie/11?type=movie");
    expect(entryHref(show)).toBe("/movie/22?type=tv");
    expect(entryHref(person)).toBe("/person/33");
  });
});
