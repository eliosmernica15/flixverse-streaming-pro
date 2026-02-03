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
      setLoading(true);

      const sections = [
        { id: 'trendingMovies', fetch: fetchTrendingMovies },
        { id: 'topRatedMovies', fetch: fetchTopRatedMovies },
        { id: 'popularMovies', fetch: fetchPopularMovies },
        { id: 'trendingTVShows', fetch: fetchTrendingTVShows },
        { id: 'popularTVShows', fetch: fetchPopularTVShows },
        { id: 'nowPlayingMovies', fetch: fetchNowPlayingMovies },
        { id: 'heroMovie', fetch: getHeroMovieOfTheWeek }
      ];

      // Step 1: Sequential fetch for core content to avoid initial saturation
      for (const section of sections) {
        try {
          const data = await section.fetch();
          if (data) {
            setMoviesData(prev => ({ ...prev, [section.id]: Array.isArray(data) ? data : [data] }));

            // Set featured movie from hero or first trending
            if (section.id === 'heroMovie' && !Array.isArray(data)) {
              setFeaturedMovie(data);
            } else if (section.id === 'trendingMovies' && Array.isArray(data) && !featuredMovie) {
              setFeaturedMovie(data[0]);
            }
          }
        } catch (err) {
          console.error(`Index failed to load ${section.id}:`, err);
        }
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Step 2: Load upcoming content (can be parallel as it's separate)
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
  }, []);

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
          <div className="mt-8 flex justify-center space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                animate={{
                  y: [0, -12, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15
                }}
              />
            ))}
          </div>
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

        {/* Welcome banner positioned after hero */}
        <div className="relative z-20 -mt-20 sm:-mt-24 mb-6 sm:mb-8">
          <PersonalizedWelcome />
        </div>

        {/* Content Sections */}
        <div className="relative z-10">
          {/* Background ambient effects */}
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[200px] pointer-events-none" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[200px] pointer-events-none" />

          <div className="space-y-14 lg:space-y-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
            <ContinueWatching />
            {moviesData['trendingMovies'] && (
              <MovieCarousel
                title="Trending Now"
                movies={moviesData['trendingMovies']}
                icon={<TrendingUp className="w-5 h-5 text-red-500" />}
                exploreAllPath="/browse/trending-now"
              />
            )}
            <div className="section-divider-glow" aria-hidden />
            {moviesData['nowPlayingMovies'] && (
              <MovieCarousel
                title="Now Playing"
                movies={moviesData['nowPlayingMovies']}
                icon={<Play className="w-5 h-5 text-green-500" />}
                exploreAllPath="/browse/now-playing"
              />
            )}
            <div className="section-divider" aria-hidden />
            {moviesData['topRatedMovies'] && (
              <MovieCarousel
                title="Top Rated"
                movies={moviesData['topRatedMovies']}
                icon={<Star className="w-5 h-5 text-yellow-500" />}
                exploreAllPath="/browse/top-rated"
              />
            )}
            <div className="section-divider" aria-hidden />
            {moviesData['popularMovies'] && (
              <MovieCarousel
                title="Popular Movies"
                movies={moviesData['popularMovies']}
                icon={<Film className="w-5 h-5 text-blue-500" />}
                exploreAllPath="/browse/popular-movies"
              />
            )}
            <div className="section-divider" aria-hidden />
            {moviesData['trendingTVShows'] && (
              <MovieCarousel
                title="Trending TV Shows"
                movies={moviesData['trendingTVShows']}
                icon={<Tv className="w-5 h-5 text-purple-500" />}
                exploreAllPath="/browse/trending-tv"
              />
            )}
            <div className="section-divider" aria-hidden />
            {moviesData['popularTVShows'] && (
              <MovieCarousel
                title="Popular TV Shows"
                movies={moviesData['popularTVShows']}
                icon={<Tv className="w-5 h-5 text-pink-500" />}
                exploreAllPath="/browse/popular-tv"
              />
            )}
            <div className="section-divider" aria-hidden />
            <MovieCarousel
              title="Coming soon"
              movies={comingSoon}
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
