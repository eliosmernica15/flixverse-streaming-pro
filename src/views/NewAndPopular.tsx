"use client";

import MovieCarousel from "@/components/MovieCarousel";
import PageHero from "@/components/PageHero";
import PageContainer from "@/components/PageContainer";
import Reveal from "@/components/Reveal";
import { useNewAndPopularCatalog } from "@/hooks/queries/useNewAndPopularCatalog";
import { Flame, TrendingUp, Clock, Calendar, Star, Tv, Radio, AlertCircle } from "lucide-react";

const NewAndPopular = () => {
  const { data, isLoading, isFetching, isError, refetch } = useNewAndPopularCatalog();
  const loading = isLoading || isFetching;

  if (isError && !data) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md border border-white/8">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6">Failed to load content. Please try again.</p>
          <button type="button" onClick={() => refetch()} className="btn-primary px-8 py-3">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="New & Popular"
        subtitle="What's trending and coming soon"
        accent="orange"
        icon={<TrendingUp className="w-6 h-6 text-white" />}
      />

      <PageContainer>
        <div className="space-y-10">
          <Reveal>
            <MovieCarousel
              title="Coming Soon"
              movies={data?.upcomingMovies || []}
              loading={loading && !data?.upcomingMovies?.length}
              icon={<Clock className="w-5 h-5 text-blue-400" />}
              exploreAllPath="/browse/coming-soon"
              comingSoon
              showWhenEmpty
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={60}>
            <MovieCarousel
              title="New Releases"
              movies={data?.newReleases || []}
              loading={loading && !data?.newReleases?.length}
              icon={<Star className="w-5 h-5 text-yellow-400" />}
              exploreAllPath="/browse/new-releases"
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={120}>
            <MovieCarousel
              title="Now Playing in Theaters"
              movies={data?.nowPlaying || []}
              loading={loading && !data?.nowPlaying?.length}
              icon={<Star className="w-5 h-5 text-purple-400" />}
              exploreAllPath="/browse/now-playing-theaters"
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={180}>
            <MovieCarousel
              title="Airing Today"
              movies={data?.airingToday || []}
              loading={loading && !data?.airingToday?.length}
              icon={<Calendar className="w-5 h-5 text-green-400" />}
              exploreAllPath="/browse/airing-today"
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={240}>
            <MovieCarousel
              title="Popular This Week"
              movies={data?.popularContent || []}
              loading={loading && !data?.popularContent?.length}
              icon={<Flame className="w-5 h-5 text-orange-400" />}
              exploreAllPath="/browse/popular-this-week"
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={300}>
            <MovieCarousel
              title="Trending TV Shows"
              movies={data?.trendingShows || []}
              loading={loading && !data?.trendingShows?.length}
              icon={<Tv className="w-5 h-5 text-cyan-400" />}
              exploreAllPath="/browse/trending-tv"
            />
          </Reveal>
          <div className="divider-glow" />

          <Reveal delay={360}>
            <MovieCarousel
              title="On The Air"
              movies={data?.onTheAir || []}
              loading={loading && !data?.onTheAir?.length}
              icon={<Radio className="w-5 h-5 text-pink-400" />}
              exploreAllPath="/browse/on-the-air"
            />
          </Reveal>
        </div>
      </PageContainer>
    </>
  );
};

export default NewAndPopular;
