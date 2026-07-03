"use client";

import dynamic from "next/dynamic";
import HeroBanner from "@/components/HeroBanner";
import MovieCarousel from "@/components/MovieCarousel";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import { useAuth } from "@/hooks/useAuth";
import { useHomeContent } from "@/hooks/queries/useHomeContent";
import { prefetchContentDetails } from "@/hooks/queries/useContentDetails";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { TrendingUp, Star, Play, Tv, Film, Calendar } from "lucide-react";

const ContinueWatching = dynamic(() => import("@/components/ContinueWatching"), {
  ssr: false,
  loading: () => null,
});

const Index = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useHomeContent();

  useEffect(() => {
    if (!data?.hero?.id) return;
    const contentType = data.hero.media_type === "tv" ? "tv" : "movie";
    prefetchContentDetails(queryClient, data.hero.id, contentType);
  }, [data?.hero, queryClient]);

  return (
    <main>
      {data?.hero ? (
        <HeroBanner movie={data.hero} />
      ) : isLoading ? (
        <div className="h-[88vh] lg:h-[92vh] bg-zinc-950 skeleton-shimmer" />
      ) : null}

      <div className="relative z-20 -mt-20 sm:-mt-24 mb-6 sm:mb-8">
        <PersonalizedWelcome />
      </div>

      <div className="relative z-10">
        <div className="space-y-14 lg:space-y-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
          {isAuthenticated && <ContinueWatching />}

          <MovieCarousel
            title="Trending Now"
            movies={data?.trendingMovies || []}
            loading={!data?.trendingMovies?.length && (isLoading || isFetching)}
            icon={<TrendingUp className="w-5 h-5 text-red-500" />}
            exploreAllPath="/browse/trending-now"
          />

          <div className="section-divider-glow" aria-hidden />

          <MovieCarousel
            title="Now Playing"
            movies={data?.nowPlayingMovies || []}
            loading={!data?.nowPlayingMovies?.length && (isLoading || isFetching)}
            icon={<Play className="w-5 h-5 text-green-500" />}
            exploreAllPath="/browse/now-playing"
          />

          <div className="section-divider" aria-hidden />

          <MovieCarousel
            title="Top Rated"
            movies={data?.topRatedMovies || []}
            loading={!data?.topRatedMovies?.length && (isLoading || isFetching)}
            icon={<Star className="w-5 h-5 text-yellow-500" />}
            exploreAllPath="/browse/top-rated"
          />

          <div className="section-divider" aria-hidden />

          <MovieCarousel
            title="Popular Movies"
            movies={data?.popularMovies || []}
            loading={!data?.popularMovies?.length && (isLoading || isFetching)}
            icon={<Film className="w-5 h-5 text-blue-500" />}
            exploreAllPath="/browse/popular-movies"
          />

          <div className="section-divider" aria-hidden />

          <MovieCarousel
            title="Trending TV Shows"
            movies={data?.trendingTVShows || []}
            loading={!data?.trendingTVShows?.length && (isLoading || isFetching)}
            icon={<Tv className="w-5 h-5 text-purple-500" />}
            exploreAllPath="/browse/trending-tv"
          />

          <div className="section-divider" aria-hidden />

          <MovieCarousel
            title="Popular TV Shows"
            movies={data?.popularTVShows || []}
            loading={!data?.popularTVShows?.length && (isLoading || isFetching)}
            icon={<Tv className="w-5 h-5 text-pink-500" />}
            exploreAllPath="/browse/popular-tv"
          />

          <div className="section-divider" aria-hidden />

          <MovieCarousel
            title="Coming soon"
            movies={data?.comingSoon || []}
            loading={!data?.comingSoon?.length && (isLoading || isFetching)}
            icon={<Calendar className="w-5 h-5 text-amber-500" />}
            showWhenEmpty
            exploreAllPath="/browse/coming-soon"
            comingSoon
          />
        </div>
      </div>
    </main>
  );
};

export default Index;
