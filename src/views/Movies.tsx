"use client";

import MovieCarousel from "@/components/MovieCarousel";
import PageHero from "@/components/PageHero";
import PageContainer from "@/components/PageContainer";
import LazySection from "@/components/LazySection";
import Reveal from "@/components/Reveal";
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

const PRIORITY_KEYS = new Set(["trending", "nowPlaying", "topRated", "popular"]);

const SECTIONS = [
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
  const loadedCount = Object.keys(data).length;

  const renderSection = (section: (typeof SECTIONS)[number], index: number) => {
    const movies = (data as Record<string, TMDBMovie[]>)[section.key];
    return (
      <Reveal key={section.key} delay={Math.min(index, 6) * 60}>
        <MovieCarousel
          title={section.title}
          movies={movies || []}
          loading={!movies?.length && (isLoading || isFetching)}
          icon={section.icon}
          exploreAllPath={section.exploreAllPath}
          comingSoon={section.comingSoon}
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
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239, 68, 68, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(168, 85, 247, 0.10) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto flex items-end gap-4">
          <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <Film className="h-7 w-7 text-red-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1.5">
              {loadedCount > 0 ? `${loadedCount} curated collections` : "Loading…"}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
              Movies
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-2">
              Discover blockbusters and hidden gems
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
            <div className="text-center py-16 glass-soft rounded-2xl max-w-md mx-auto">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Could not load movies</h3>
              <p className="text-gray-400 mb-6">There was a connection issue. Please try again.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors focus-ring"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
};

export default Movies;
