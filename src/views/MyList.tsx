"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import MovieCarousel from "@/components/MovieCarousel";
import PageHero from "@/components/PageHero";
import PageContainer from "@/components/PageContainer";
import EmptyState from "@/components/EmptyState";
import { fetchMovieDetails, fetchTVShowDetails, TMDBMovie } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { Heart, LogIn, Film, Sparkles } from "lucide-react";

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
      <EmptyState
        icon={<LogIn className="w-10 h-10 text-red-500" />}
        title="Sign in required"
        description="Create an account or sign in to save your favorite movies and TV shows to your personal list."
        actionLabel="Sign In / Sign Up"
        actionHref="/auth"
      />
    );
  }

  const loading = listLoading || (movieList.length > 0 && detailsLoading);

  return (
    <>
      <PageHero
        title="My List"
        subtitle={loading ? "Loading your list..." : "Your personal watchlist"}
        meta={!loading && myMovies.length > 0 ? `${myMovies.length} saved title${myMovies.length > 1 ? "s" : ""}` : undefined}
        accent="rose"
        icon={<Heart className="w-6 h-6 text-white fill-current" />}
      />

      <PageContainer>
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
          <EmptyState
            icon={<Film className="w-10 h-10 text-gray-500" />}
            title="Your list is empty"
            description="Start building your personal watchlist by adding movies and TV shows you want to watch later."
            actionLabel="Discover Movies"
            actionHref="/"
          />
        )}
      </PageContainer>
    </>
  );
};

export default MyList;
