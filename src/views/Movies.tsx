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
  const [moviesData, setMoviesData] = useState<{ [key: string]: TMDBMovie[] }>({});
  const [loading, setLoading] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const loadMovies = async () => {
      setLoading(true);

      const sections = [
        { id: 'trending', fetch: fetchTrendingMovies },
        { id: 'topRated', fetch: fetchTopRatedMovies },
        { id: 'popular', fetch: fetchPopularMovies },
        { id: 'upcoming', fetch: getUpcomingMoviesOnly },
        { id: 'nowPlaying', fetch: fetchNowPlayingMovies },
        { id: 'action', fetch: fetchActionMovies },
        { id: 'comedy', fetch: fetchComedyMovies },
        { id: 'horror', fetch: fetchHorrorMovies },
        { id: 'romance', fetch: fetchRomanceMovies },
        { id: 'sciFi', fetch: fetchSciFiMovies },
        { id: 'drama', fetch: fetchDramaMovies },
        { id: 'thriller', fetch: fetchThrillerMovies },
        { id: 'animation', fetch: fetchAnimationMovies },
        { id: 'fantasy', fetch: fetchFantasyMovies },
        { id: 'adventure', fetch: fetchAdventureMovies }
      ];

      // Load in batches of 3 to avoid saturating mobile connection limits (usually 6)
      const batchSize = 3;
      for (let i = 0; i < sections.length; i += batchSize) {
        const batch = sections.slice(i, i + batchSize);
        try {
          const results = await Promise.all(
            batch.map(async (s) => ({ id: s.id, data: await s.fetch() }))
          );

          setMoviesData(prev => {
            const next = { ...prev };
            results.forEach(r => {
              if (r.data && r.data.length > 0) {
                next[r.id] = r.data;
              }
            });
            return next;
          });
        } catch (err) {
          console.error(`Batch ${i / batchSize} failed:`, err);
          setErrorCount(prev => prev + 1);
        }

        // Brief pause between batches to let the event loop breathe, 
        // especially important for mobile browsers
        if (i + batchSize < sections.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setLoading(false);
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
          {moviesData['trending'] && (
            <>
              <MovieCarousel
                title="Trending Movies"
                movies={moviesData['trending']}
                icon={<Flame className="w-5 h-5 text-orange-400" />}
                exploreAllPath="/browse/trending-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['nowPlaying'] && (
            <>
              <MovieCarousel
                title="Now Playing"
                movies={moviesData['nowPlaying']}
                icon={<Clock className="w-5 h-5 text-green-400" />}
                exploreAllPath="/browse/now-playing-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['topRated'] && (
            <>
              <MovieCarousel
                title="Top Rated Movies"
                movies={moviesData['topRated']}
                icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                exploreAllPath="/browse/top-rated-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['popular'] && (
            <>
              <MovieCarousel
                title="Popular Movies"
                movies={moviesData['popular']}
                icon={<Sparkles className="w-5 h-5 text-purple-400" />}
                exploreAllPath="/browse/popular-movies"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['action'] && (
            <>
              <MovieCarousel
                title="Action"
                movies={moviesData['action']}
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                exploreAllPath="/browse/action"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['comedy'] && (
            <>
              <MovieCarousel
                title="Comedy"
                movies={moviesData['comedy']}
                icon={<Laugh className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/comedy"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['drama'] && (
            <>
              <MovieCarousel
                title="Drama"
                movies={moviesData['drama']}
                icon={<Drama className="w-5 h-5 text-blue-400" />}
                exploreAllPath="/browse/drama"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['thriller'] && (
            <>
              <MovieCarousel
                title="Thriller"
                movies={moviesData['thriller']}
                icon={<Zap className="w-5 h-5 text-red-400" />}
                exploreAllPath="/browse/thriller"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['horror'] && (
            <>
              <MovieCarousel
                title="Horror"
                movies={moviesData['horror']}
                icon={<Skull className="w-5 h-5 text-gray-400" />}
                exploreAllPath="/browse/horror"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['sciFi'] && (
            <>
              <MovieCarousel
                title="Sci-Fi"
                movies={moviesData['sciFi']}
                icon={<Rocket className="w-5 h-5 text-cyan-400" />}
                exploreAllPath="/browse/sci-fi"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['fantasy'] && (
            <>
              <MovieCarousel
                title="Fantasy"
                movies={moviesData['fantasy']}
                icon={<Wand2 className="w-5 h-5 text-violet-400" />}
                exploreAllPath="/browse/fantasy"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['adventure'] && (
            <>
              <MovieCarousel
                title="Adventure"
                movies={moviesData['adventure']}
                icon={<Compass className="w-5 h-5 text-emerald-400" />}
                exploreAllPath="/browse/adventure"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['animation'] && (
            <>
              <MovieCarousel
                title="Animation"
                movies={moviesData['animation']}
                icon={<Sparkles className="w-5 h-5 text-amber-400" />}
                exploreAllPath="/browse/animation"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['romance'] && (
            <>
              <MovieCarousel
                title="Romance"
                movies={moviesData['romance']}
                icon={<Heart className="w-5 h-5 text-rose-400" />}
                exploreAllPath="/browse/romance"
              />
              <div className="section-divider" />
            </>
          )}

          {moviesData['upcoming'] && (
            <MovieCarousel
              title="Coming Soon"
              movies={moviesData['upcoming']}
              icon={<Clock className="w-5 h-5 text-blue-400" />}
              exploreAllPath="/browse/upcoming"
              comingSoon
            />
          )}

          {!loading && Object.keys(moviesData).length === 0 && (
            <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-white/5">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Could not load movies</h3>
              <p className="text-gray-400 mb-6">There was a connection issue. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-500 hover:bg-red-600 px-8 py-3 rounded-xl font-bold transition-all"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Movies;
