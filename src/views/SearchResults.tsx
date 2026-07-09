"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import MovieCard from "@/components/MovieCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";
import { searchMultiWithPagination, getContentImage, TMDBMovie } from "@/utils/tmdbApi";
import { Search, Clock, X } from "lucide-react";
import { SearchFilters, SearchFilterState } from "@/components/SearchFilters";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const RECENT_KEY = "flixverse:recent-searches";

interface SearchResultItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  profile_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  known_for_department?: string;
}

const SearchResults = () => {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SearchFilterState>({
    mediaType: "all",
    year: "",
    sort: "relevance",
  });
  const [allResults, setAllResults] = useState<TMDBMovie[]>([]);
  const [allPeople, setAllPeople] = useState<SearchResultItem[]>([]);

  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setPage(1);
    setAllResults([]);
    setAllPeople([]);
  }, [query]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    if (!query) return;
    setRecent((prev) => {
      const next = [query, ...prev.filter((q) => q !== query)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [query]);

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) window.location.href = `/search?q=${encodeURIComponent(trimmed)}`;
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => searchMultiWithPagination(query, page),
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  // Merge results for infinite scroll
  useEffect(() => {
    if (!data?.results) return;
    const items = data.results as SearchResultItem[];
    const moviesTv = items.filter(
      (item) => item.media_type === "movie" || item.media_type === "tv"
    ) as TMDBMovie[];
    const people = items.filter((item) => item.media_type === "person");

    if (page === 1) {
      setAllResults(moviesTv);
      setAllPeople(people);
    } else {
      setAllResults((prev) => [...prev, ...moviesTv]);
      setAllPeople((prev) => [...prev, ...people]);
    }
  }, [data, page]);

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const loading = isLoading || isFetching;
  const hasMore = page < totalPages;

  // Apply client-side filters
  const filteredResults = allResults.filter((item) => {
    if (filters.mediaType === "person") return false;
    if (filters.mediaType === "movie" && item.media_type !== "movie") return false;
    if (filters.mediaType === "tv" && item.media_type !== "tv") return false;
    if (filters.year) {
      const date = item.release_date || item.first_air_date || "";
      if (!date.startsWith(filters.year)) return false;
    }
    return true;
  });

  const filteredPeople = filters.mediaType === "all" || filters.mediaType === "person"
    ? allPeople
    : [];

  // Sort
  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (filters.sort) {
      case "rating_desc":
        return (b.vote_average || 0) - (a.vote_average || 0);
      case "rating_asc":
        return (a.vote_average || 0) - (b.vote_average || 0);
      case "date_desc":
        return new Date(b.release_date || b.first_air_date || 0).getTime() -
               new Date(a.release_date || a.first_air_date || 0).getTime();
      case "date_asc":
        return new Date(a.release_date || a.first_air_date || 0).getTime() -
               new Date(b.release_date || b.first_air_date || 0).getTime();
      default:
        return 0;
    }
  });

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
    }
  }, [loading, hasMore]);

  const { sentinelRef } = useInfiniteScroll({
    enabled: query.length > 0,
    onLoadMore: loadMore,
    hasMore,
    isLoading: loading,
  });

  const handleFiltersChange = (newFilters: SearchFilterState) => {
    setFilters(newFilters);
  };

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto page-enter">
      <div className="mb-8">
        <span className="eyebrow">Search</span>
        <h1 className="display-title text-balance mt-1">
          {query ? (
            <>
              Results for <span className="gradient-text">&quot;{query}&quot;</span>
            </>
          ) : (
            "Find your next favorite"
          )}
        </h1>
      </div>

      {/* Inline search input */}
      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            id="search-input"
            type="search"
            defaultValue={query}
            placeholder="Search movies, TV shows, people..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value;
                runSearch(val);
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 focus-visible:ring-2 focus-visible:ring-red-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Recent searches */}
      {recent.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Recent
          </span>
          {recent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => runSearch(r)}
              className="chip hover:bg-white/10 text-gray-300 transition-colors focus-ring min-h-[36px]"
            >
              {r}
              <span
                role="button"
                tabIndex={-1}
                aria-hidden
                className="ml-1 text-gray-500 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setRecent((prev) => prev.filter((x) => x !== r));
                  try {
                    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.filter((x) => x !== r)));
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {!query ? (
        <div className="text-center py-16">
          <div className="glass-panel rounded-3xl p-10 max-w-md mx-auto">
            <Search className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-300">Enter a search term to find movies, TV shows, and more.</p>
          </div>
        </div>
      ) : loading && allResults.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
          ))}
        </div>
        ) : sortedResults.length === 0 && filteredPeople.length === 0 && !loading ? (
          <div className="text-center py-16">
            <div className="glass-panel rounded-3xl p-10 max-w-md mx-auto">
              <Search className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300">No results found for &quot;{query}&quot;</p>
              <p className="mt-2 text-sm text-gray-500">Try a different keyword or check spelling.</p>
            </div>
          </div>
        ) : (
          <>
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              resultCount={sortedResults.length + filteredPeople.length}
            />

            {sortedResults.length > 0 && (
              <Reveal as="section" className="stagger mb-12 content-auto">
                <SectionHeader title="Movies & TV Shows" eyebrow="Results" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 mt-2">
                  {sortedResults.map((item) => (
                    <div key={`${item.id}-${item.media_type}`} className="hover-lift-sm rounded-2xl">
                      <MovieCard movie={item} />
                    </div>
                  ))}
                </div>
              </Reveal>
            )}

            {filteredPeople.length > 0 && (
              <Reveal as="section" className="mb-12 content-auto">
                <SectionHeader title="People" eyebrow="Cast & Crew" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
                  {filteredPeople.map((person) => (
                    <a
                      key={`person-${person.id}`}
                      href={`/person/${person.id}`}
                      className="flex flex-col items-center p-4 rounded-2xl surface hover:surface-elevated transition-colors border border-white/10 hover-lift-sm focus-ring"
                    >
                      <img
                        src={getContentImage(person, "profile", "medium")}
                        alt={person.name ?? "Person"}
                        loading="lazy"
                        className="w-20 h-20 rounded-full object-cover border-2 border-white/20"
                      />
                      <span className="mt-2 text-sm font-medium text-center line-clamp-2">{person.name}</span>
                      {person.known_for_department && (
                        <span className="text-xs text-gray-400">{person.known_for_department}</span>
                      )}
                    </a>
                  ))}
                </div>
              </Reveal>
            )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more indicator */}
          {loading && allResults.length > 0 && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}

          {!hasMore && allResults.length > 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              You&apos;ve reached the end of results
            </p>
          )}
        </>
      )}
    </main>
  );
};

export default SearchResults;
