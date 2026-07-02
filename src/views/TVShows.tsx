"use client";

import MovieCarousel from "@/components/MovieCarousel";
import PageHero from "@/components/PageHero";
import PageContainer from "@/components/PageContainer";
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
  const loadedCount = Object.keys(data).length;

  return (
    <>
      <PageHero
        title="TV Shows"
        subtitle="Binge-worthy series for every mood"
        meta={loadedCount > 0 ? `${loadedCount} curated collections` : undefined}
        accent="purple"
        icon={<Tv className="w-6 h-6 text-white" />}
      />

      <PageContainer>
        <div className="space-y-10">
          {SECTIONS.map((section, index) => {
            const shows = (data as Record<string, TMDBMovie[]>)[section.key];
            return (
              <div key={section.key}>
                <MovieCarousel
                  title={section.title}
                  movies={shows || []}
                  loading={!shows?.length && (isLoading || isFetching)}
                  icon={section.icon}
                  exploreAllPath={section.exploreAllPath}
                />
                {index < SECTIONS.length - 1 && <div className="section-divider mt-10" />}
              </div>
            );
          })}

          {isError && !isLoading && (
            <div className="text-center py-12 glass-card rounded-2xl max-w-md mx-auto border border-white/8">
              <Tv className="w-8 h-8 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No TV shows available</h3>
              <p className="text-gray-400 mb-6">Please try again in a moment</p>
              <button type="button" onClick={() => refetch()} className="btn-primary px-6 py-2.5">
                Reload
              </button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
};

export default TVShows;
