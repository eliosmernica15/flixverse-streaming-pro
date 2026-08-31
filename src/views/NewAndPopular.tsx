"use client";

import { useState, useMemo } from "react";
import MovieCard from "@/components/MovieCard";
import PageContainer from "@/components/PageContainer";
import Reveal from "@/components/Reveal";
import { useNewAndPopularCatalog } from "@/hooks/queries/useNewAndPopularCatalog";
import {
  Flame,
  TrendingUp,
  Clock,
  Calendar,
  Star,
  Tv,
  Radio,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { TMDBMovie, getContentType } from "@/utils/tmdbApi";

type NPTab = "all" | "movies" | "tv";

const TABS: { id: NPTab; label: string; icon: typeof Flame }[] = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "movies", label: "Movies", icon: Flame },
  { id: "tv", label: "TV", icon: Tv },
];

const NewAndPopular = () => {
  const { data, isLoading, isFetching, isError, refetch } = useNewAndPopularCatalog();
  const loading = isLoading || isFetching;
  const [tab, setTab] = useState<NPTab>("all");

  // Combine all movie/TV buckets into a single tab-aware stream
  const moviePool = useMemo(() => {
    const items: TMDBMovie[] = [];
    if (tab === "all" || tab === "movies") {
      items.push(...(data?.upcomingMovies || []), ...(data?.newReleases || []), ...(data?.nowPlaying || []));
    }
    if (tab === "all" || tab === "tv") {
      items.push(...(data?.airingToday || []), ...(data?.trendingShows || []), ...(data?.onTheAir || []));
    }
    return items;
  }, [data, tab]);

  if (isError && !data) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center glass-soft p-8 rounded-2xl max-w-md border border-white/8">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6">Failed to load content. Please try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors focus-ring"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalCount = (data?.upcomingMovies?.length || 0) + (data?.newReleases?.length || 0) +
    (data?.nowPlaying?.length || 0) + (data?.airingToday?.length || 0) +
    (data?.trendingShows?.length || 0) + (data?.onTheAir?.length || 0);

  return (
    <div className="relative">
      {/* Cinematic header */}
      <header className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(249, 115, 22, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(239, 68, 68, 0.12) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400 mb-1.5">
            What's hot right now
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
            New &amp; Popular
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2">
            {loading ? "Loading fresh titles…" : `${totalCount} titles across movies & TV`}
          </p>
        </div>
      </header>

      <PageContainer className="!pt-0">
        {/* Tabs */}
        <div className="glass-soft rounded-lg p-2 mb-6 inline-flex items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "bg-white text-black"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading && moviePool.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md skeleton-shimmer" />
            ))}
          </div>
        ) : moviePool.length === 0 ? (
          <div className="glass-soft rounded-2xl py-16 text-center">
            <p className="text-gray-300">No titles in this category right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 content-auto">
            {moviePool.map((movie, idx) => (
              <MovieCard
                key={`${tab}-${movie.id}-${idx}`}
                movie={movie}
                index={idx}
                priority={idx < 6}
                comingSoon={tab === "all" && getContentType(movie) === "movie" && idx < 3 ? false : false}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
};

export default NewAndPopular;
