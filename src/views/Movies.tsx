"use client";

import MovieCarousel from "@/components/MovieCarousel";
import { useMoviesCatalog } from "@/hooks/queries/useMoviesCatalog";
import {
  Film,
  Flame,
  Trophy,
  Clock,
  Zap,
  Laugh,
  Drama,
  Skull,
  Heart,
  Rocket,
  Sparkles,
  Compass,
  Wand2,
} from "lucide-react";
import { TMDBMovie } from "@/utils/tmdbApi";

const SECTIONS: {
  key: string;
  title: string;
  icon: React.ReactNode;
  exploreAllPath: string;
  comingSoon?: boolean;
}[] = [
  { key: "trending", title: "Trending Movies", icon: <Flame className="w-5 h-5 text-orange-400" />, exploreAllPath: "/browse/trending-movies" },
  { key: "nowPlaying", title: "Now Playing", icon: <Clock className="w-5 h-5 text-green-400" />, exploreAllPath: "/browse/now-playing-movies" },
  { key: "topRated", title: "Top Rated Movies", icon: <Trophy className="w-5 h-5 text-yellow-400" />, exploreAllPath: "/browse/top-rated-movies" },
  { key: "popular", title: "Popular Movies", icon: <Sparkles className="w-5 h-5 text-purple-400" />, exploreAllPath: "/browse/popular-movies" },
  { key: "action", title: "Action", icon: <Zap className="w-5 h-5 text-yellow-500" />, exploreAllPath: "/browse/action" },
  { key: "comedy", title: "Comedy", icon: <Laugh className="w-5 h-5 text-pink-400" />, exploreAllPath: "/browse/comedy" },
  { key: "drama", title: "Drama", icon: <Drama className="w-5 h-5 text-blue-400" />, exploreAllPath: "/browse/drama" },
  { key: "thriller", title: "Thriller", icon: <Zap className="w-5 h-5 text-red-400" />, exploreAllPath: "/browse/thriller" },
  { key: "horror", title: "Horror", icon: <Skull className="w-5 h-5 text-gray-400" />, exploreAllPath: "/browse/horror" },
  { key: "sciFi", title: "Sci-Fi", icon: <Rocket className="w-5 h-5 text-cyan-400" />, exploreAllPath: "/browse/sci-fi" },
  { key: "fantasy", title: "Fantasy", icon: <Wand2 className="w-5 h-5 text-violet-400" />, exploreAllPath: "/browse/fantasy" },
  { key: "adventure", title: "Adventure", icon: <Compass className="w-5 h-5 text-emerald-400" />, exploreAllPath: "/browse/adventure" },
  { key: "animation", title: "Animation", icon: <Sparkles className="w-5 h-5 text-amber-400" />, exploreAllPath: "/browse/animation" },
  { key: "romance", title: "Romance", icon: <Heart className="w-5 h-5 text-rose-400" />, exploreAllPath: "/browse/romance" },
  { key: "upcoming", title: "Coming Soon", icon: <Clock className="w-5 h-5 text-blue-400" />, exploreAllPath: "/browse/upcoming", comingSoon: true },
];

const Movies = () => {
  const { data = {}, isLoading, isFetching, isError, refetch } = useMoviesCatalog();

  return (
  <>
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">Movies</h1>
              <p className="text-gray-400 text-sm">Discover blockbusters and hidden gems</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-10">
          {SECTIONS.map((section, index) => {
            const movies = (data as Record<string, TMDBMovie[]>)[section.key];
            const showDivider = index < SECTIONS.length - 1;

            return (
              <div key={section.key}>
                <MovieCarousel
                  title={section.title}
                  movies={movies || []}
                  loading={!movies?.length && (isLoading || isFetching)}
                  icon={section.icon}
                  exploreAllPath={section.exploreAllPath}
                  comingSoon={section.comingSoon}
                />
                {showDivider && <div className="section-divider mt-10" />}
              </div>
            );
          })}

          {isError && !isLoading && (
            <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-white/5">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Could not load movies</h3>
              <p className="text-gray-400 mb-6">There was a connection issue. Please try again.</p>
              <button
                onClick={() => refetch()}
                className="bg-red-500 hover:bg-red-600 px-8 py-3 rounded-xl font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
  </>
  );
};

export default Movies;
