"use client";

import dynamic from "next/dynamic";
import HeroBanner from "@/components/HeroBanner";
import MovieCarousel from "@/components/MovieCarousel";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import LazySection from "@/components/LazySection";
import { PlaySomething } from "@/components/PlaySomething";
import { useAuth } from "@/hooks/useAuth";
import { useHomeContent } from "@/hooks/queries/useHomeContent";
import { prefetchContentDetails } from "@/hooks/queries/useContentDetails";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { TrendingUp, Star, Play, Tv, Film, Calendar } from "lucide-react";
import Reveal from "@/components/Reveal";
import { isFeatureEnabled } from "@/lib/featureFlags";

const Top10Row = dynamic(() => import("@/components/Top10Row"), {
  ssr: false,
  loading: () => <div className="h-64 skeleton-shimmer rounded-2xl" />,
});

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
    <div className="page-enter">
      {data?.hero ? (
        <HeroBanner movie={data.hero} />
      ) : isLoading ? (
        <div className="h-[88vh] lg:h-[92vh] bg-zinc-950 skeleton shimmer-overlay" />
      ) : null}

      <div className="relative z-20 -mt-20 sm:-mt-24 mb-6 sm:mb-8 flex items-center gap-3 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
        <PersonalizedWelcome />
        <PlaySomething />
      </div>

      <div className="relative z-10">
        <div className="space-y-14 lg:space-y-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
          {isAuthenticated && (
            <Reveal>
              <ContinueWatching />
            </Reveal>
          )}

          <Reveal>
            <MovieCarousel
              title="Trending Now"
              movies={data?.trendingMovies || []}
              loading={!data?.trendingMovies?.length && (isLoading || isFetching)}
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
              exploreAllPath="/browse/trending-now"
            />
          </Reveal>

          {isFeatureEnabled("top10-row") && (data?.trendingMovies?.length ?? 0) >= 10 && (
            <Reveal delay={40}>
              <Top10Row movies={data!.trendingMovies!} />
            </Reveal>
          )}

          <div className="divider-glow" aria-hidden />

          <Reveal delay={80}>
            <MovieCarousel
              title="Now Playing"
              movies={data?.nowPlayingMovies || []}
              loading={!data?.nowPlayingMovies?.length && (isLoading || isFetching)}
              icon={<Play className="w-5 h-5 text-green-500" />}
              exploreAllPath="/browse/now-playing"
            />
          </Reveal>

          <LazySection minHeight={360}>
            <>
              <div className="divider-glow" aria-hidden />

              <Reveal delay={0}>
                <MovieCarousel
                  title="Top Rated"
                  movies={data?.topRatedMovies || []}
                  loading={!data?.topRatedMovies?.length && (isLoading || isFetching)}
                  icon={<Star className="w-5 h-5 text-yellow-500" />}
                  exploreAllPath="/browse/top-rated"
                />
              </Reveal>

              <div className="divider-glow" aria-hidden />

              <Reveal delay={80}>
                <MovieCarousel
                  title="Popular Movies"
                  movies={data?.popularMovies || []}
                  loading={!data?.popularMovies?.length && (isLoading || isFetching)}
                  icon={<Film className="w-5 h-5 text-blue-500" />}
                  exploreAllPath="/browse/popular-movies"
                />
              </Reveal>

              <div className="divider-glow" aria-hidden />

              <Reveal delay={160}>
                <MovieCarousel
                  title="Trending TV Shows"
                  movies={data?.trendingTVShows || []}
                  loading={!data?.trendingTVShows?.length && (isLoading || isFetching)}
                  icon={<Tv className="w-5 h-5 text-purple-500" />}
                  exploreAllPath="/browse/trending-tv"
                />
              </Reveal>

              <div className="divider-glow" aria-hidden />

              <Reveal delay={240}>
                <MovieCarousel
                  title="Popular TV Shows"
                  movies={data?.popularTVShows || []}
                  loading={!data?.popularTVShows?.length && (isLoading || isFetching)}
                  icon={<Tv className="w-5 h-5 text-pink-500" />}
                  exploreAllPath="/browse/popular-tv"
                />
              </Reveal>

              <div className="divider-glow" aria-hidden />

              <Reveal delay={320}>
                <MovieCarousel
                  title="Coming soon"
                  movies={data?.comingSoon || []}
                  loading={!data?.comingSoon?.length && (isLoading || isFetching)}
                  icon={<Calendar className="w-5 h-5 text-amber-500" />}
                  showWhenEmpty
                  exploreAllPath="/browse/coming-soon"
                  comingSoon
                />
              </Reveal>
            </>
          </LazySection>
        </div>
      </div>
    </div>
  );
};

export default Index;
