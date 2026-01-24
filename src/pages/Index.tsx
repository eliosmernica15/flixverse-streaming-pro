import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import MovieCarousel from "@/components/MovieCarousel";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import ContinueWatching from "@/components/ContinueWatching";
import { 
  fetchTrendingMovies, 
  fetchTopRatedMovies, 
  fetchPopularMovies,
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchNowPlayingMovies,
  TMDBMovie 
} from "@/utils/tmdbApi";
import { getHeroMovieOfTheWeek } from "@/utils/popularMoviesRotator";
import { TrendingUp, Star, Play, Tv, Film, Sparkles } from "lucide-react";

const Index = () => {
  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBMovie[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([]);
  const [trendingTVShows, setTrendingTVShows] = useState<TMDBMovie[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<TMDBMovie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TMDBMovie[]>([]);
  const [featuredMovie, setFeaturedMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const [
          trending,
          topRated,
          popular,
          trendingShows,
          popularShows,
          nowPlaying,
          heroMovie
        ] = await Promise.all([
          fetchTrendingMovies(),
          fetchTopRatedMovies(),
          fetchPopularMovies(),
          fetchTrendingTVShows(),
          fetchPopularTVShows(),
          fetchNowPlayingMovies(),
          getHeroMovieOfTheWeek()
        ]);

        setTrendingMovies(trending);
        setTopRatedMovies(topRated);
        setPopularMovies(popular);
        setTrendingTVShows(trendingShows);
        setPopularTVShows(popularShows);
        setNowPlayingMovies(nowPlaying);
        setFeaturedMovie(heroMovie || trending[0] || topRated[0]);
        
      } catch (error) {
        console.error('Error loading content:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <Sparkles className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
            <div className="absolute inset-0 blur-2xl bg-red-500/20"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2">FlixVerse</h2>
          <p className="text-gray-400">Loading your entertainment...</p>
          <div className="mt-6 flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className="w-2 h-2 bg-red-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <main>
        <PersonalizedWelcome />
        
        {featuredMovie && (
          <HeroBanner movie={featuredMovie} />
        )}

        {/* Content Sections */}
        <div className="relative -mt-32 z-10">
          <div className="space-y-12 lg:space-y-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
            
            {/* Continue Watching Section */}
            <ContinueWatching />
            
            <MovieCarousel 
              title="Trending Now" 
              movies={trendingMovies}
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
            />
            
            <div className="section-divider"></div>
            
            <MovieCarousel 
              title="Now Playing" 
              movies={nowPlayingMovies}
              icon={<Play className="w-5 h-5 text-green-500" />}
            />
            
            <div className="section-divider"></div>
            
            <MovieCarousel 
              title="Top Rated" 
              movies={topRatedMovies}
              icon={<Star className="w-5 h-5 text-yellow-500" />}
            />
            
            <div className="section-divider"></div>
            
            <MovieCarousel 
              title="Popular Movies" 
              movies={popularMovies}
              icon={<Film className="w-5 h-5 text-blue-500" />}
            />
            
            <div className="section-divider"></div>
            
            <MovieCarousel 
              title="Trending TV Shows" 
              movies={trendingTVShows}
              icon={<Tv className="w-5 h-5 text-purple-500" />}
            />
            
            <div className="section-divider"></div>
            
            <MovieCarousel 
              title="Popular TV Shows" 
              movies={popularTVShows}
              icon={<Tv className="w-5 h-5 text-pink-500" />}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black/50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-6 h-6 text-red-500" />
                <span className="text-xl font-bold">
                  <span className="text-gradient-primary">Flix</span>
                  <span className="text-white">Verse</span>
                </span>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Help</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
              </div>
              <p className="text-sm text-gray-500">
                © 2024 FlixVerse. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
