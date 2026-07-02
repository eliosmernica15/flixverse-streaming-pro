"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import MovieCard from "@/components/MovieCard";
import { searchMultiWithPagination, getContentImage, TMDBMovie } from "@/utils/tmdbApi";
import { Search, Film, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    setPage(1);
  }, [query]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => searchMultiWithPagination(query, page),
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const all = data?.results ?? [];
  const results = all.filter(
    (item: SearchResultItem) => item.media_type === "movie" || item.media_type === "tv"
  );
  const people = all.filter((item: SearchResultItem) => item.media_type === "person") as SearchResultItem[];
  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const loading = isLoading || isFetching;

  const movieTvResults = results as TMDBMovie[];
  const hasContent = movieTvResults.length > 0 || people.length > 0;
  const isEmpty = !loading && query && !hasContent;

  const loadPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Search className="w-8 h-8 text-red-500" />
          Search results
          {query && <span className="text-gray-400 font-normal">for &quot;{query}&quot;</span>}
        </h1>
        {!loading && query && (
          <p className="text-gray-400 mt-1">
            {totalResults} result{totalResults !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      {!query ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Enter a search term to find movies, TV shows, and more.</p>
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No results found for &quot;{query}&quot;</p>
          <p className="mt-2 text-sm">Try a different keyword or check spelling.</p>
        </div>
      ) : (
        <>
          {movieTvResults.length > 0 && (
            <section className="mb-12 content-auto">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Film className="w-5 h-5 text-red-500" />
                Movies & TV Shows
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {movieTvResults.map((item) => (
                  <MovieCard key={`${item.id}-${item.media_type}`} movie={item} />
                ))}
              </div>
            </section>
          )}

          {people.length > 0 && (
            <section className="mb-12 content-auto">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-red-500" />
                People
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {people.map((person) => (
                  <a
                    key={`person-${person.id}`}
                    href={`https://www.themoviedb.org/person/${person.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
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
            </section>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1}
                className="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages}
                className="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default SearchResults;
