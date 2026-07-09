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
        {index < SECTIONS.length - 1 && <div className="divider-glow mt-10" />}
      </Reveal>
    );
  };

  const prioritySections = SECTIONS.filter((s) => PRIORITY_KEYS.has(s.key));
  const deferredSections = SECTIONS.filter((s) => !PRIORITY_KEYS.has(s.key));

  return (
    <>
      <PageHero
        title="Movies"
        subtitle="Discover blockbusters and hidden gems"
        meta={loadedCount > 0 ? `${loadedCount} curated collections` : undefined}
        accent="red"
        icon={<Film className="w-6 h-6 text-white" />}
      />

      <PageContainer>
        <div className="space-y-10">
          {prioritySections.map((section, index) => renderSection(section, index))}

          <LazySection minHeight={480} className="space-y-10">
            <>
              <div className="divider-glow" />
              {deferredSections.map((section, index) =>
                renderSection(section, prioritySections.length + index)
              )}
            </>
          </LazySection>

          {isError && !isLoading && (
            <div className="text-center py-16 glass-card rounded-3xl border border-white/8">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Could not load movies</h3>
              <p className="text-gray-400 mb-6">There was a connection issue. Please try again.</p>
              <button type="button" onClick={() => refetch()} className="btn-primary px-8 py-3">
                Retry
              </button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
};

export default Movies;
