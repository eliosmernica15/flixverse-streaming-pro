import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import MovieCard from "@/components/MovieCard";
import {
  searchMultiWithPagination,
  getContentImage,
  getContentType,
  TMDBMovie,
} from "@/utils/tmdbApi";
import { Search, Film, User, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SearchResultItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
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
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [people, setPeople] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetchResults = useCallback(async (searchQuery: string, pageNum: number = 1) => {
    if (!searchQuery) {
      setResults([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchMultiWithPagination(searchQuery, pageNum);
      const all = data.results;
      const content = all.filter(
        (item: SearchResultItem) =>
          item.media_type === "movie" || item.media_type === "tv"
      );
      const persons = all.filter((item: SearchResultItem) => item.media_type === "person");
      setResults(content);
      setPeople(persons);
      setPage(data.page);
      setTotalPages(data.total_pages);
      setTotalResults(data.total_results);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(query, 1);
  }, [query, fetchResults]);

  const loadPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchResults(query, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const movieTvResults = results as TMDBMovie[];
  const hasContent = movieTvResults.length > 0 || people.length > 0;
  const isEmpty = !loading && query && !hasContent;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Search className="w-8 h-8 text-red-500" />
            Search results
            {query && (
              <span className="text-gray-400 font-normal">
                for &quot;{query}&quot;
              </span>
            )}
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
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full"
            />
          </div>
        ) : isEmpty ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No results found for &quot;{query}&quot;</p>
            <p className="mt-2 text-sm">Try a different keyword or check spelling.</p>
          </div>
        ) : (
          <>
            {/* Movies & TV */}
            {movieTvResults.length > 0 && (
              <section className="mb-12">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Film className="w-5 h-5 text-red-500" />
                  Movies & TV Shows
                </h2>
                <motion.div
                  layout
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <AnimatePresence mode="popLayout">
                    {movieTvResults.map((item, index) => (
                      <motion.div
                        key={`${item.id}-${item.media_type}-${index}`}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.2 }}
                      >
                        <MovieCard movie={item} index={index} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </section>
            )}

            {/* People */}
            {people.length > 0 && (
              <section className="mb-12">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-red-500" />
                  People
                </h2>
                <motion.div
                  layout
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {people.map((person, index) => (
                    <motion.a
                      key={`person-${person.id}`}
                      href={`https://www.themoviedb.org/person/${person.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.2 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <img
                        src={getContentImage(
                          person,
                          "profile",
                          "medium"
                        )}
                        alt={person.name ?? "Person"}
                        loading="lazy"
                        className="w-20 h-20 rounded-full object-cover border-2 border-white/20"
                      />
                      <span className="mt-2 text-sm font-medium text-center line-clamp-2">
                        {person.name}
                      </span>
                      {person.known_for_department && (
                        <span className="text-xs text-gray-400">
                          {person.known_for_department}
                        </span>
                      )}
                    </motion.a>
                  ))}
                </motion.div>
              </section>
            )}

            {/* Pagination */}
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
    </div>
  );
};

export default SearchResults;
