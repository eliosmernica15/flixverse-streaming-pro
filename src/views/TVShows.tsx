"use client";

import MovieCarousel from "@/components/MovieCarousel";
import PageHero from "@/components/PageHero";
import PageContainer from "@/components/PageContainer";
import LazySection from "@/components/LazySection";
import { useTVShowsCatalog } from "@/hooks/queries/useTVShowsCatalog";
import Reveal from "@/components/Reveal";
import { Tv, Flame, Trophy, Calendar, Radio, Zap, Laugh, Drama, Search, Rocket, FileText } from "lucide-react";
import { TMDBMovie } from "@/utils/tmdbApi";

const PRIORITY_KEYS = new Set(["trending", "airingToday", "onTheAir", "popular", "topRated"]);

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

  const renderSection = (section: (typeof SECTIONS)[number], index: number) => {
    const shows = (data as Record<string, TMDBMovie[]>)[section.key];
    return (
      <Reveal key={section.key} delay={Math.min(index, 6) * 60}>
        <MovieCarousel
          title={section.title}
          movies={shows || []}
          loading={!shows?.length && (isLoading || isFetching)}
          icon={section.icon}
          exploreAllPath={section.exploreAllPath}
        />
      </Reveal>
    );
  };

  const prioritySections = SECTIONS.filter((s) => PRIORITY_KEYS.has(s.key));
  const deferredSections = SECTIONS.filter((s) => !PRIORITY_KEYS.has(s.key));

  return (
    <div className="relative">
      <header className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(168, 85, 247, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(59, 130, 246, 0.10) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto flex items-end gap-4">
          <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <Tv className="h-7 w-7 text-purple-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400 mb-1.5">
              {loadedCount > 0 ? `${loadedCount} curated collections` : "Loading…"}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
              TV Shows
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-2">
              Binge-worthy series for every mood
            </p>
          </div>
        </div>
      </header>

      <PageContainer className="!pt-0">
        <div className="space-y-10">
          {prioritySections.map((section, index) => renderSection(section, index))}

          <LazySection minHeight={480} className="space-y-10">
            <>
              {deferredSections.map((section, index) =>
                renderSection(section, prioritySections.length + index)
              )}
            </>
          </LazySection>

          {isError && !isLoading && (
            <div className="text-center py-12 glass-soft rounded-2xl max-w-md mx-auto border border-white/8">
              <Tv className="w-8 h-8 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No TV shows available</h3>
              <p className="text-gray-400 mb-6">Please try again in a moment</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors focus-ring"
              >
                Reload
              </button>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
};

export default TVShows;
