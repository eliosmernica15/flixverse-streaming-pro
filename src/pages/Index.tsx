import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { TrendingUp, Star, Play, Tv, Film, Sparkles, Heart, Github, Twitter, Instagram } from "lucide-react";
import { motion } from "framer-motion";

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
            <MovieCarousel 
              title="Trending Now" 
              movies={trendingMovies}
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
            />
            <div className="section-divider-glow" aria-hidden />
            <MovieCarousel 
              title="Now Playing" 
              movies={nowPlayingMovies}
              icon={<Play className="w-5 h-5 text-green-500" />}
            />
            <div className="section-divider" aria-hidden />
            <MovieCarousel 
              title="Top Rated" 
              movies={topRatedMovies}
              icon={<Star className="w-5 h-5 text-yellow-500" />}
            />
            <div className="section-divider" aria-hidden />
            <MovieCarousel 
              title="Popular Movies" 
              movies={popularMovies}
              icon={<Film className="w-5 h-5 text-blue-500" />}
            />
            <div className="section-divider" aria-hidden />
            <MovieCarousel 
              title="Trending TV Shows" 
              movies={trendingTVShows}
              icon={<Tv className="w-5 h-5 text-purple-500" />}
            />
            <div className="section-divider" aria-hidden />
            <MovieCarousel 
              title="Popular TV Shows" 
              movies={popularTVShows}
              icon={<Tv className="w-5 h-5 text-pink-500" />}
            />
          </div>
        </div>

        {/* Premium Footer */}
        <footer className="relative border-t border-white/5 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-950 to-transparent" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[150px]" />
          
          <div className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {/* Main footer content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
              {/* Brand */}
              <div className="lg:col-span-1">
                <div className="flex items-center space-x-2.5 mb-6">
                  <div className="relative">
                    <Sparkles className="w-8 h-8 text-red-500" />
                    <div className="absolute inset-0 blur-xl bg-red-500/30" />
                  </div>
                  <span className="text-2xl font-black">
                    <span className="text-gradient-primary">Flix</span>
                    <span className="text-white">Verse</span>
                  </span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Your ultimate destination for movies and TV shows. Stream unlimited content anytime, anywhere.
                </p>
                <div className="flex items-center space-x-4">
                  <a href="#" className="p-2.5 glass-card rounded-xl hover:bg-white/10 transition-all duration-300 group">
                    <Twitter className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  </a>
                  <a href="#" className="p-2.5 glass-card rounded-xl hover:bg-white/10 transition-all duration-300 group">
                    <Instagram className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  </a>
                  <a href="#" className="p-2.5 glass-card rounded-xl hover:bg-white/10 transition-all duration-300 group">
                    <Github className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  </a>
                </div>
              </div>
              
              {/* Quick Links */}
              <div>
                <h4 className="text-white font-semibold mb-5">Browse</h4>
                <ul className="space-y-3">
                  {[
                    { to: '/', label: 'Home' },
                    { to: '/movies', label: 'Movies' },
                    { to: '/tv-shows', label: 'TV Shows' },
                    { to: '/new-and-popular', label: 'New & Popular' },
                    { to: '/my-list', label: 'My List' },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link to={to} className="text-gray-400 hover:text-white text-sm transition-colors duration-300 hover:pl-1 inline-block">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Categories */}
              <div>
                <h4 className="text-white font-semibold mb-5">Categories</h4>
                <ul className="space-y-3">
                  {['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance'].map((cat) => (
                    <li key={cat}>
                      <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors duration-300 hover:pl-1">
                        {cat}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Support */}
              <div>
                <h4 className="text-white font-semibold mb-5">Support</h4>
                <ul className="space-y-3">
                  {['Help Center', 'Terms of Service', 'Privacy Policy', 'Contact Us', 'FAQ'].map((link) => (
                    <li key={link}>
                      <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors duration-300 hover:pl-1">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Bottom bar */}
            <div className="pt-8 border-t border-white/5">
              <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                <p className="text-sm text-gray-500 flex items-center space-x-1.5">
                  <span>© {new Date().getFullYear()} FlixVerse. Made with</span>
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
                  <span>for movie lovers</span>
                </p>
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <span>Powered by TMDB</span>
                  <span>|</span>
                  <span>v2.0</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
