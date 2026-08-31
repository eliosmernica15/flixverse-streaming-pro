"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import MovieCard from "@/components/MovieCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";
import { searchMultiWithPagination, getContentImage, TMDBMovie } from "@/utils/tmdbApi";
import { Search, Clock, X, User } from "lucide-react";
import { SearchFilters, SearchFilterState } from "@/components/SearchFilters";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { trackSearch } from "@/lib/analytics";

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
  const router = useRouter();
  const t = useTranslations("search");
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
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
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

  useEffect(() => {
    if (query && !loading) {
      trackSearch(query, sortedResults.length + filteredPeople.length);
    }
  }, [query, loading, sortedResults.length, filteredPeople.length]);

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
    <div className="page-enter">
      {/* Cinematic header */}
      <header className="relative pt-24 pb-8 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1.5">
            {query ? t("results") : "Search"}
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-[1.1]">
            {query ? (
              <>
                {t("results")} <span className="text-white">&quot;{query}&quot;</span>
              </>
            ) : (
              t("findFavorite")
            )}
          </h1>
        </div>
      </header>

      <main className="pb-16 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
        {/* Inline search input */}
        <div className="mb-5">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="search-input"
              type="search"
              defaultValue={query}
              placeholder={t("placeholderLong")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value;
                  runSearch(val);
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/40 focus-visible:ring-2 focus-visible:ring-red-500/40 transition-colors"
            />
          </div>
        </div>

        {/* Recent searches */}
        {recent.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Recent
            </span>
            {recent.map((r) => (
              <div
                key={r}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300"
              >
                <button
                  type="button"
                  onClick={() => runSearch(r)}
                  className="hover:text-white transition-colors focus-ring rounded"
                >
                  {r}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${r} from recent searches`}
                  className="p-0.5 text-gray-500 hover:text-white transition-colors focus-ring rounded"
                  onClick={() => {
                    setRecent((prev) => {
                      const updated = prev.filter((x) => x !== r);
                      try {
                        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
                      } catch {
                        /* ignore */
                      }
                      return updated;
                    });
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!query ? (
          <div className="glass-soft rounded-2xl py-16 px-8 text-center max-w-md mx-auto">
            <Search className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-gray-300 text-sm">{t("findFavorite")}</p>
            <p className="text-gray-500 text-xs mt-2">Try a movie title, actor, or director.</p>
          </div>
        ) : loading && allResults.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md skeleton-shimmer" />
            ))}
          </div>
        ) : sortedResults.length === 0 && filteredPeople.length === 0 && !loading ? (
          <div className="glass-soft rounded-2xl py-16 px-8 text-center max-w-md mx-auto">
            <Search className="w-10 h-10 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-300 text-sm">{t("noResults")}</p>
            <p className="text-gray-500 text-xs mt-2">{t("tryDifferent")}</p>
          </div>
        ) : (
          <>
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              resultCount={sortedResults.length + filteredPeople.length}
            />

            {sortedResults.length > 0 && (
              <section className="mb-12 content-auto">
                <SectionHeader title={t("moviesAndTv")} eyebrow={`${sortedResults.length} titles`} />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 mt-3">
                  {sortedResults.map((item) => (
                    <MovieCard key={`${item.id}-${item.media_type}`} movie={item} />
                  ))}
                </div>
              </section>
            )}

            {filteredPeople.length > 0 && (
              <section className="mb-12 content-auto">
                <SectionHeader title={t("people")} eyebrow={`${filteredPeople.length} people`} />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 mt-3">
                  {filteredPeople.map((person) => {
                    const profileImg = person.profile_path
                      ? getContentImage(person, "profile", "medium")
                      : null;
                    return (
                      <Link
                        key={`person-${person.id}`}
                        href={`/person/${person.id}`}
                        className="group flex flex-col items-center p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15 transition-all hover:-translate-y-0.5 focus-ring"
                      >
                        <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/15 group-hover:ring-red-500/60 transition-all shrink-0 bg-white/5">
                          {profileImg ? (
                            <Image
                              src={profileImg}
                              alt={person.name ?? "Person"}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/20 to-purple-500/20">
                              <User className="w-8 h-8 text-white/60" />
                            </div>
                          )}
                        </div>
                        <span className="mt-2 text-sm font-semibold text-center text-white line-clamp-2 group-hover:text-red-400 transition-colors">
                          {person.name}
                        </span>
                        {person.known_for_department && (
                          <span className="text-[11px] text-gray-400 mt-0.5">{person.known_for_department}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
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
              <p className="text-center text-gray-500 text-xs py-8 uppercase tracking-wider">
                You&apos;ve reached the end of results
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SearchResults;
