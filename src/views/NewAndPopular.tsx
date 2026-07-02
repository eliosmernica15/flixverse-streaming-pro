"use client";

import MovieCarousel from "@/components/MovieCarousel";
import { useNewAndPopularCatalog } from "@/hooks/queries/useNewAndPopularCatalog";
import { Flame, TrendingUp, Clock, Calendar, Star, Tv, Radio, AlertCircle } from "lucide-react";

const NewAndPopular = () => {
  const { data, isLoading, isFetching, isError, refetch } = useNewAndPopularCatalog();
  const loading = isLoading || isFetching;

  if (isError && !data) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6">Failed to load content. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-3 rounded-full font-semibold transition-transform hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-900/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">New & Popular</h1>
              <p className="text-gray-400 text-sm">What&apos;s trending and coming soon</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-10">
          <MovieCarousel
            title="Coming Soon"
            movies={data?.upcomingMovies || []}
            loading={loading && !data?.upcomingMovies?.length}
            icon={<Clock className="w-5 h-5 text-blue-400" />}
            exploreAllPath="/browse/coming-soon"
            comingSoon
            showWhenEmpty
          />
          <div className="section-divider" />

          <MovieCarousel
            title="New Releases"
            movies={data?.newReleases || []}
            loading={loading && !data?.newReleases?.length}
            icon={<Star className="w-5 h-5 text-yellow-400" />}
            exploreAllPath="/browse/new-releases"
          />
          <div className="section-divider" />

          <MovieCarousel
            title="Now Playing in Theaters"
            movies={data?.nowPlaying || []}
            loading={loading && !data?.nowPlaying?.length}
            icon={<Star className="w-5 h-5 text-purple-400" />}
            exploreAllPath="/browse/now-playing-theaters"
          />
          <div className="section-divider" />

          <MovieCarousel
            title="Airing Today"
            movies={data?.airingToday || []}
            loading={loading && !data?.airingToday?.length}
            icon={<Calendar className="w-5 h-5 text-green-400" />}
            exploreAllPath="/browse/airing-today"
          />
          <div className="section-divider" />

          <MovieCarousel
            title="Popular This Week"
            movies={data?.popularContent || []}
            loading={loading && !data?.popularContent?.length}
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            exploreAllPath="/browse/popular-this-week"
          />
          <div className="section-divider" />

          <MovieCarousel
            title="Trending TV Shows"
            movies={data?.trendingShows || []}
            loading={loading && !data?.trendingShows?.length}
            icon={<Tv className="w-5 h-5 text-cyan-400" />}
            exploreAllPath="/browse/trending-tv"
          />
          <div className="section-divider" />

          <MovieCarousel
            title="On The Air"
            movies={data?.onTheAir || []}
            loading={loading && !data?.onTheAir?.length}
            icon={<Radio className="w-5 h-5 text-pink-400" />}
            exploreAllPath="/browse/on-the-air"
          />
        </div>
      </div>
    </>
  );
};

export default NewAndPopular;
