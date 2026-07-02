"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import MovieCarousel from "@/components/MovieCarousel";
import { fetchMovieDetails, fetchTVShowDetails, TMDBMovie } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { Heart, LogIn, Film, Plus, Sparkles } from "lucide-react";

const MyList = () => {
  const { isAuthenticated } = useAuth();
  const { movieList, loading: listLoading } = useUserMovieList();

  const listKey = movieList.map((item) => `${item.media_type}-${item.movie_id}`).join(",");

  const { data: myMovies = [], isLoading: detailsLoading } = useQuery({
    queryKey: ["my-list-details", listKey],
    queryFn: async () => {
      const movies = await Promise.all(
        movieList.map((item) =>
          item.media_type === "tv"
            ? fetchTVShowDetails(item.movie_id)
            : fetchMovieDetails(item.movie_id)
        )
      );
      return movies.filter((movie): movie is TMDBMovie => movie !== null);
    },
    enabled: isAuthenticated && !listLoading && movieList.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 pt-16">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <LogIn className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">Sign In Required</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Create an account or sign in to save your favorite movies and TV shows to your personal list.
          </p>
          <Link
            href="/auth"
            className="inline-block bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-xl shadow-red-500/20"
          >
            Sign In / Sign Up
          </Link>
        </div>
      </div>
    );
  }

  const loading = listLoading || (movieList.length > 0 && detailsLoading);

  return (
    <>
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-900/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">My List</h1>
              <p className="text-gray-400 text-sm">
                {loading
                  ? "Loading your list..."
                  : myMovies.length > 0
                    ? `${myMovies.length} title${myMovies.length > 1 ? "s" : ""} saved`
                    : "Your personal watchlist"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : myMovies.length > 0 ? (
          <MovieCarousel
            title="Your Saved Titles"
            movies={myMovies}
            icon={<Sparkles className="w-5 h-5 text-yellow-400" />}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="glass-card p-12 rounded-3xl max-w-lg text-center">
              <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Film className="w-10 h-10 text-gray-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Your list is empty</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Start building your personal watchlist by adding movies and TV shows you want to watch later.
              </p>
              <Link
                href="/"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 rounded-full font-semibold transition-transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>Discover Movies</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MyList;
