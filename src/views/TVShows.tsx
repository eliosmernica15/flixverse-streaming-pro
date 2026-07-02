"use client";

import MovieCarousel from "@/components/MovieCarousel";
import { useTVShowsCatalog } from "@/hooks/queries/useTVShowsCatalog";
import { Tv, Flame, Trophy, Calendar, Radio, Zap, Laugh, Drama, Search, Rocket, FileText } from "lucide-react";
import { TMDBMovie } from "@/utils/tmdbApi";

const SECTIONS = [
  { key: "trending", title: "Trending TV Shows", icon: <Flame className="w-5 h-5 text-orange-400" />, exploreAllPath: "/browse/trending-tv-shows" },
  { key: "airingToday", title: "Airing Today", icon: <Calendar className="w-5 h-5 text-green-400" />, exploreAllPath: "/browse/airing-today-shows" },
  { key: "onTheAir", title: "On The Air", icon: <Radio className="w-5 h-5 text-red-400" />, exploreAllPath: "/browse/on-the-air-shows" },
  { key: "popular", title: "Popular TV Shows", icon: <Flame className="w-5 h-5 text-pink-400" />, exploreAllPath: "/browse/popular-tv-shows" },
  { key: "topRated", title: "Top Rated TV Shows", icon: <Trophy className="w-5 h-5 text-yellow-400" />, exploreAllPath: "/browse/top-rated-tv" },
  { key: "action", title: "Action & Adventure", icon: <Zap className="w-5 h-5 text-yellow-500" />, exploreAllPath: "/browse/action-adventure" },
  { key: "drama", title: "Drama Series", icon: <Drama className="w-5 h-5 text-blue-400" />, exploreAllPath: "/browse/drama-series" },
  { key: "comedy", title: "Comedy Shows", icon: <Laugh className="w-5 h-5 text-pink-400" />, exploreAllPath: "/browse/comedy-shows" },
  { key: "crime", title: "Crime & Mystery", icon: <Search className="w-5 h-5 text-gray-400" />, exploreAllPath: "/browse/crime-mystery" },
  { key: "sciFi", title: "Sci-Fi & Fantasy", icon: <Rocket className="w-5 h-5 text-cyan-400" />, exploreAllPath: "/browse/sci-fi-fantasy" },
  { key: "documentary", title: "Documentaries", icon: <FileText className="w-5 h-5 text-emerald-400" />, exploreAllPath: "/browse/documentaries" },
];

const TVShows = () => {
  const { data = {}, isLoading, isFetching, isError, refetch } = useTVShowsCatalog();

  return (
    <>
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">TV Shows</h1>
              <p className="text-gray-400 text-sm">Binge-worthy series for every mood</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-10">
          {SECTIONS.map((section, index) => {
            const shows = (data as Record<string, TMDBMovie[]>)[section.key];
            const showDivider = index < SECTIONS.length - 1;

            return (
              <div key={section.key}>
                <MovieCarousel
                  title={section.title}
                  movies={shows || []}
                  loading={!shows?.length && (isLoading || isFetching)}
                  icon={section.icon}
                  exploreAllPath={section.exploreAllPath}
                />
                {showDivider && <div className="section-divider mt-10" />}
              </div>
            );
          })}

          {isError && !isLoading && (
            <div className="text-center py-12 glass-card rounded-2xl max-w-md mx-auto">
              <Tv className="w-8 h-8 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No TV shows available</h3>
              <p className="text-gray-400 mb-6">Please try again in a moment</p>
              <button
                onClick={() => refetch()}
                className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-2 rounded-full font-semibold hover:scale-105 transition-transform"
              >
                Reload
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TVShows;
