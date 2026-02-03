"use client";


import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import MovieCarousel from "@/components/MovieCarousel";
import Footer from "@/components/Footer";
import { Film, Flame, Trophy, Clock, Zap, Laugh, Drama, Skull, Heart, Rocket, Sparkles, Compass, Wand2 } from "lucide-react";
import { getUpcomingMoviesOnly } from "@/utils/popularMoviesRotator";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchPopularMovies,
  fetchNowPlayingMovies,
  fetchActionMovies,
  fetchComedyMovies,
  fetchHorrorMovies,
  fetchRomanceMovies,
  fetchSciFiMovies,
  fetchDramaMovies,
  fetchThrillerMovies,
  fetchAnimationMovies,
  fetchFantasyMovies,
  fetchAdventureMovies,
  TMDBMovie
} from "@/utils/tmdbApi";

const Movies = () => {
  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBMovie[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBMovie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TMDBMovie[]>([]);
  const [actionMovies, setActionMovies] = useState<TMDBMovie[]>([]);
  const [comedyMovies, setComedyMovies] = useState<TMDBMovie[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<TMDBMovie[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<TMDBMovie[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<TMDBMovie[]>([]);
  const [dramaMovies, setDramaMovies] = useState<TMDBMovie[]>([]);
  const [thrillerMovies, setThrillerMovies] = useState<TMDBMovie[]>([]);
  const [animationMovies, setAnimationMovies] = useState<TMDBMovie[]>([]);
  const [fantasyMovies, setFantasyMovies] = useState<TMDBMovie[]>([]);
  const [adventureMovies, setAdventureMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        const [
          trending,
          topRated,
          popular,
          upcoming,
          nowPlaying,
          action,
          comedy,
          horror,
          romance,
          sciFi,
          drama,
          thriller,
          animation,
          fantasy,
          adventure
        ] = await Promise.all([
          fetchTrendingMovies(),
          fetchTopRatedMovies(),
          fetchPopularMovies(),
          getUpcomingMoviesOnly(),
          fetchNowPlayingMovies(),
          fetchActionMovies(),
          fetchComedyMovies(),
          fetchHorrorMovies(),
          fetchRomanceMovies(),
          fetchSciFiMovies(),
          fetchDramaMovies(),
          fetchThrillerMovies(),
          fetchAnimationMovies(),
          fetchFantasyMovies(),
          fetchAdventureMovies()
        ]);

        setTrendingMovies(trending);
        setTopRatedMovies(topRated);
        setPopularMovies(popular);
        setUpcomingMovies(upcoming);
        setNowPlayingMovies(nowPlaying);
        setActionMovies(action);
        setComedyMovies(comedy);
        setHorrorMovies(horror);
        setRomanceMovies(romance);
        setSciFiMovies(sciFi);
        setDramaMovies(drama);
        setThrillerMovies(thriller);
        setAnimationMovies(animation);
        setFantasyMovies(fantasy);
        setAdventureMovies(adventure);
        setLoading(false);
      } catch (error) {
        console.error('Error loading movies:', error);
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            <Film className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400">Loading Movies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white animate-fade-in">
      <Navigation />

      {/* Hero Header */}
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-transparent to-transparent"></div>
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">Movies</h1>
              <p className="text-gray-400 text-sm">Discover blockbusters and hidden gems</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-10">
          {trendingMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Trending Movies"
                movies={trendingMovies}
                icon={<Flame className="w-5 h-5 text-orange-400" />}
                exploreAllPath="/browse/trending-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {nowPlayingMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Now Playing"
                movies={nowPlayingMovies}
                icon={<Clock className="w-5 h-5 text-green-400" />}
                exploreAllPath="/browse/now-playing-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {topRatedMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Top Rated Movies"
                movies={topRatedMovies}
                icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                exploreAllPath="/browse/top-rated-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {popularMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Popular Movies"
                movies={popularMovies}
                icon={<Sparkles className="w-5 h-5 text-purple-400" />}
                exploreAllPath="/browse/popular-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {actionMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Action"
                movies={actionMovies}
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                exploreAllPath="/browse/action"
              />
              <div className="section-divider" />
            </>
          )}

          {comedyMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Comedy"
                movies={comedyMovies}
                icon={<Laugh className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/comedy"
              />
              <div className="section-divider" />
            </>
          )}

          {dramaMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Drama"
                movies={dramaMovies}
                icon={<Drama className="w-5 h-5 text-blue-400" />}
                exploreAllPath="/browse/drama"
              />
              <div className="section-divider" />
            </>
          )}

          {thrillerMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Thriller"
                movies={thrillerMovies}
                icon={<Zap className="w-5 h-5 text-red-400" />}
                exploreAllPath="/browse/thriller"
              />
              <div className="section-divider" />
            </>
          )}

          {horrorMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Horror"
                movies={horrorMovies}
                icon={<Skull className="w-5 h-5 text-gray-400" />}
                exploreAllPath="/browse/horror"
              />
              <div className="section-divider" />
            </>
          )}

          {sciFiMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Sci-Fi"
                movies={sciFiMovies}
                icon={<Rocket className="w-5 h-5 text-cyan-400" />}
                exploreAllPath="/browse/sci-fi"
              />
              <div className="section-divider" />
            </>
          )}

          {fantasyMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Fantasy"
                movies={fantasyMovies}
                icon={<Wand2 className="w-5 h-5 text-violet-400" />}
                exploreAllPath="/browse/fantasy"
              />
              <div className="section-divider" />
            </>
          )}

          {adventureMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Adventure"
                movies={adventureMovies}
                icon={<Compass className="w-5 h-5 text-emerald-400" />}
                exploreAllPath="/browse/adventure"
              />
              <div className="section-divider" />
            </>
          )}

          {animationMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Animation"
                movies={animationMovies}
                icon={<Sparkles className="w-5 h-5 text-amber-400" />}
                exploreAllPath="/browse/animation"
              />
              <div className="section-divider" />
            </>
          )}

          {romanceMovies.length > 0 && (
            <>
              <MovieCarousel
                title="Romance"
                movies={romanceMovies}
                icon={<Heart className="w-5 h-5 text-rose-400" />}
                exploreAllPath="/browse/romance"
              />
              <div className="section-divider" />
            </>
          )}

          {upcomingMovies.length > 0 && (
            <MovieCarousel
              title="Coming Soon"
              movies={upcomingMovies}
              icon={<Clock className="w-5 h-5 text-blue-400" />}
              exploreAllPath="/browse/upcoming"
              comingSoon
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Movies;
