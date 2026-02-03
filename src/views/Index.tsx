"use client";

import { useState, useEffect } from "react";
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
  TMDBMovie
} from "@/utils/tmdbApi";
import { getHeroMovieOfTheWeek } from "@/utils/popularMoviesRotator";
import { TrendingUp, Star, Play, Tv, Film, Sparkles, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const [moviesData, setMoviesData] = useState<{ [key: string]: TMDBMovie[] }>({});
  const [comingSoon, setComingSoon] = useState<TMDBMovie[]>([]);
  const [featuredMovie, setFeaturedMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      // Step 1: Sequential fetch for core content
      const sections = [
        { id: 'heroMovie', fetch: getHeroMovieOfTheWeek },
        { id: 'trendingMovies', fetch: fetchTrendingMovies },
        { id: 'topRatedMovies', fetch: fetchTopRatedMovies },
        { id: 'popularMovies', fetch: fetchPopularMovies },
        { id: 'trendingTVShows', fetch: fetchTrendingTVShows },
        { id: 'popularTVShows', fetch: fetchPopularTVShows },
        { id: 'nowPlayingMovies', fetch: fetchNowPlayingMovies },
      ];

      for (const section of sections) {
        try {
          const data = await section.fetch();
          if (data) {
            setMoviesData(prev => ({ ...prev, [section.id]: Array.isArray(data) ? data : [data] }));

            if (section.id === 'heroMovie' && !Array.isArray(data)) {
              setFeaturedMovie(data);
            } else if (section.id === 'trendingMovies' && Array.isArray(data) && !featuredMovie) {
              setFeaturedMovie(data[0]);
            }
          }
        } catch (err) {
          console.error(`Index failed to load ${section.id}:`, err);
        }

        // Hide global loader as soon as we have enough to show the hero section
        if (Object.keys(moviesData).length >= 1 || section.id === 'heroMovie') {
          setLoading(false);
        }
      }

      // Step 2: Load upcoming content
      try {
        const [upcomingMoviesRaw, upcomingTVRaw] = await Promise.all([
          fetchUpcomingMovies(),
          fetchUpcomingTVShows()
        ]);

        const notReleasedMovies = (upcomingMoviesRaw || []).filter((m) => isNotReleasedYet(m));
        const notReleasedTV = (upcomingTVRaw || []).filter((m) => isNotReleasedYet(m));
        const combined = [...notReleasedMovies, ...notReleasedTV].sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateA.localeCompare(dateB);
        });
        setComingSoon(combined);
      } catch (err) {
        console.error('Index upcoming fetch failed:', err);
      }

      setLoading(false);
    };

    loadContent();
  }, [featuredMovie]);

  if (loading && Object.keys(moviesData).length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 border-4 border-red-500/20 border-t-red-500 rounded-full"
            />
            <Sparkles className="w-8 h-8 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute inset-0 blur-2xl bg-red-500/20 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black mb-2">
            <span className="text-gradient-primary">Flix</span>
            <span className="text-white">Verse</span>
          </h2>
          <p className="text-gray-400 text-lg">Loading your entertainment...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main>
        {featuredMovie && (
          <HeroBanner movie={featuredMovie} />
        )}

        <div className="relative z-20 -mt-20 sm:-mt-24 mb-6 sm:mb-8">
          <PersonalizedWelcome />
        </div>

        <div className="relative z-10">
          <div className="space-y-14 lg:space-y-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
            <ContinueWatching />

            <MovieCarousel
              title="Trending Now"
              movies={moviesData['trendingMovies'] || []}
              loading={!moviesData['trendingMovies']}
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
              exploreAllPath="/browse/trending-now"
            />

            <div className="section-divider-glow" aria-hidden />

            <MovieCarousel
              title="Now Playing"
              movies={moviesData['nowPlayingMovies'] || []}
              loading={!moviesData['nowPlayingMovies']}
              icon={<Play className="w-5 h-5 text-green-500" />}
              exploreAllPath="/browse/now-playing"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Top Rated"
              movies={moviesData['topRatedMovies'] || []}
              loading={!moviesData['topRatedMovies']}
              icon={<Star className="w-5 h-5 text-yellow-500" />}
              exploreAllPath="/browse/top-rated"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Popular Movies"
              movies={moviesData['popularMovies'] || []}
              loading={!moviesData['popularMovies']}
              icon={<Film className="w-5 h-5 text-blue-500" />}
              exploreAllPath="/browse/popular-movies"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Trending TV Shows"
              movies={moviesData['trendingTVShows'] || []}
              loading={!moviesData['trendingTVShows']}
              icon={<Tv className="w-5 h-5 text-purple-500" />}
              exploreAllPath="/browse/trending-tv"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Popular TV Shows"
              movies={moviesData['popularTVShows'] || []}
              loading={!moviesData['popularTVShows']}
              icon={<Tv className="w-5 h-5 text-pink-500" />}
              exploreAllPath="/browse/popular-tv"
            />

            <div className="section-divider" aria-hidden />

            <MovieCarousel
              title="Coming soon"
              movies={comingSoon}
              loading={comingSoon.length === 0 && loading}
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
