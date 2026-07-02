"use client";

import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import MovieCarousel from "@/components/MovieCarousel";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import ContinueWatching from "@/components/ContinueWatching";
import Footer from "@/components/Footer";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchPopularMovies,
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchNowPlayingMovies,
  fetchUpcomingMovies,
  fetchUpcomingTVShows,
  isNotReleasedYet,
  TMDBMovie,
} from "@/utils/tmdbApi";
import { getHeroMovieOfTheWeek } from "@/utils/popularMoviesRotator";
import { TrendingUp, Star, Play, Tv, Film, Sparkles, Calendar } from "lucide-react";

async function loadHomeContent() {
  const [
    heroMovie,
    trendingMovies,
    topRatedMovies,
    popularMovies,
    trendingTVShows,
    popularTVShows,
    nowPlayingMovies,
    upcomingMoviesRaw,
    upcomingTVRaw,
  ] = await Promise.all([
    getHeroMovieOfTheWeek(),
    fetchTrendingMovies(),
    fetchTopRatedMovies(),
    fetchPopularMovies(),
    fetchTrendingTVShows(),
    fetchPopularTVShows(),
    fetchNowPlayingMovies(),
    fetchUpcomingMovies(),
    fetchUpcomingTVShows(),
  ]);

  const notReleasedMovies = (upcomingMoviesRaw || []).filter((movie) => isNotReleasedYet(movie));
  const notReleasedTV = (upcomingTVRaw || []).filter((show) => isNotReleasedYet(show));
  const comingSoon = [...notReleasedMovies, ...notReleasedTV].sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || "";
    const dateB = b.release_date || b.first_air_date || "";
    return dateA.localeCompare(dateB);
  });

  const hero = heroMovie && !Array.isArray(heroMovie)
    ? heroMovie
    : trendingMovies?.[0] ?? null;

  return {
    hero,
    trendingMovies: trendingMovies || [],
    topRatedMovies: topRatedMovies || [],
    popularMovies: popularMovies || [],
    trendingTVShows: trendingTVShows || [],
    popularTVShows: popularTVShows || [],
    nowPlayingMovies: nowPlayingMovies || [],
    comingSoon,
  };
}

const Index = () => {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["home-content"],
    queryFn: loadHomeContent,
    staleTime: 10 * 60 * 1000,
  });

  const showInitialLoader = isLoading && !data;

  if (showInitialLoader) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative mb-8 mx-auto w-20 h-20">
            <div className="w-20 h-20 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
            <Sparkles className="w-8 h-8 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-3xl font-black mb-2">
            <span className="text-gradient-primary">Flix</span>
            <span className="text-white">Verse</span>
          </h2>
          <p className="text-gray-400 text-lg">Loading your entertainment...</p>
        </div>
      </div>
    );
  }

  const featuredMovie = data?.hero ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main>
        {featuredMovie && <HeroBanner movie={featuredMovie} />}

        <div className="relative z-20 -mt-20 sm:-mt-24 mb-6 sm:mb-8">
          <PersonalizedWelcome />
        </div>

        <div className="relative z-10">
          <div className="space-y-14 lg:space-y-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
            <ContinueWatching />

            <MovieCarousel
              title="Trending Now"
              movies={data?.trendingMovies || []}
              loading={!data?.trendingMovies?.length && isFetching}
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
              exploreAllPath="/browse/trending-now"
            />

            <div className="section-divider-glow" aria-hidden />

            <MovieCarousel
              title="Now Playing"
              movies={data?.nowPlayingMovies || []}
              loading={!data?.nowPlayingMovies?.length && isFetching}
              icon={<Play className="w-5 h-5 text-green-500" />}
              exploreAllPath="/browse/now-playing"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Top Rated"
              movies={data?.topRatedMovies || []}
              loading={!data?.topRatedMovies?.length && isFetching}
              icon={<Star className="w-5 h-5 text-yellow-500" />}
              exploreAllPath="/browse/top-rated"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Popular Movies"
              movies={data?.popularMovies || []}
              loading={!data?.popularMovies?.length && isFetching}
              icon={<Film className="w-5 h-5 text-blue-500" />}
              exploreAllPath="/browse/popular-movies"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Trending TV Shows"
              movies={data?.trendingTVShows || []}
              loading={!data?.trendingTVShows?.length && isFetching}
              icon={<Tv className="w-5 h-5 text-purple-500" />}
              exploreAllPath="/browse/trending-tv"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Popular TV Shows"
              movies={data?.popularTVShows || []}
              loading={!data?.popularTVShows?.length && isFetching}
              icon={<Tv className="w-5 h-5 text-pink-500" />}
              exploreAllPath="/browse/popular-tv"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Coming soon"
              movies={data?.comingSoon || []}
              loading={!data?.comingSoon?.length && isFetching}
              icon={<Calendar className="w-5 h-5 text-amber-500" />}
              showWhenEmpty
              exploreAllPath="/browse/coming-soon"
              comingSoon
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
