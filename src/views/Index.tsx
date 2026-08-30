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
import { useTranslations } from "next-intl";
import { usePartyGuestRoute } from "@/hooks/player/usePartyGuestRoute";
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

const PersonalizedHomeRows = dynamic(() => import("@/components/PersonalizedHomeRows"), {
  ssr: false,
  loading: () => null,
});

const Index = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useHomeContent();
  const t = useTranslations("carousel");

  usePartyGuestRoute();

  useEffect(() => {
    const heroes = data?.heroMovies?.length ? data.heroMovies : data?.hero ? [data.hero] : [];
    for (const m of heroes) {
      const contentType = m.media_type === "tv" ? "tv" : "movie";
      prefetchContentDetails(queryClient, m.id, contentType);
    }
  }, [data?.hero, data?.heroMovies, queryClient]);

  return (
    <div className="page-enter">
      {data?.hero ? (
        <HeroBanner movie={data.hero} movies={data.heroMovies} />
      ) : isLoading ? (
        <div className="h-[72vh] sm:h-[88vh] lg:h-[92vh] bg-zinc-950 skeleton shimmer-overlay" />
      ) : null}

      <div className="relative z-20 -mt-16 sm:-mt-20 mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
        <PersonalizedWelcome />
        <div className="w-full shrink-0 sm:w-auto [&_button]:w-full sm:[&_button]:w-auto sm:[&_button]:justify-center">
          <PlaySomething />
        </div>
      </div>

      <div className="relative z-10">
        <div className="space-y-12 lg:space-y-16 pb-16 lg:pb-24 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
          {isAuthenticated && (
            <Reveal>
              <ContinueWatching />
            </Reveal>
          )}

          <Reveal>
            <PersonalizedHomeRows />
          </Reveal>

          <Reveal>
            <MovieCarousel
              title={t("trendingNow")}
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

          <Reveal delay={80}>
            <MovieCarousel
              title={t("nowPlaying")}
              movies={data?.nowPlayingMovies || []}
              loading={!data?.nowPlayingMovies?.length && (isLoading || isFetching)}
              icon={<Play className="w-5 h-5 text-green-500" />}
              exploreAllPath="/browse/now-playing"
            />
          </Reveal>

          <LazySection minHeight={360}>
            <>
              <Reveal delay={0}>
                <MovieCarousel
                  title={t("topRated")}
                  movies={data?.topRatedMovies || []}
                  loading={!data?.topRatedMovies?.length && (isLoading || isFetching)}
                  icon={<Star className="w-5 h-5 text-yellow-500" />}
                  exploreAllPath="/browse/top-rated"
                />
              </Reveal>

              <Reveal delay={80}>
                <MovieCarousel
                  title={t("popularMovies")}
                  movies={data?.popularMovies || []}
                  loading={!data?.popularMovies?.length && (isLoading || isFetching)}
                  icon={<Film className="w-5 h-5 text-blue-500" />}
                  exploreAllPath="/browse/popular-movies"
                />
              </Reveal>

              <Reveal delay={160}>
                <MovieCarousel
                  title={t("trendingTv")}
                  movies={data?.trendingTVShows || []}
                  loading={!data?.trendingTVShows?.length && (isLoading || isFetching)}
                  icon={<Tv className="w-5 h-5 text-purple-500" />}
                  exploreAllPath="/browse/trending-tv"
                />
              </Reveal>

              <Reveal delay={240}>
                <MovieCarousel
                  title={t("popularTv")}
                  movies={data?.popularTVShows || []}
                  loading={!data?.popularTVShows?.length && (isLoading || isFetching)}
                  icon={<Tv className="w-5 h-5 text-pink-500" />}
                  exploreAllPath="/browse/popular-tv"
                />
              </Reveal>

              <Reveal delay={320}>
                <MovieCarousel
                  title={t("comingSoon")}
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
