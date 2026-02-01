
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import MovieCarousel from "@/components/MovieCarousel";
import { TMDBMovie } from "@/utils/tmdbApi";
import { getUpcomingMoviesOnly } from "@/utils/popularMoviesRotator";
import { Flame, TrendingUp, Clock, Calendar, Star, Tv, Radio, AlertCircle } from "lucide-react";
import { 
  fetchTrendingMovies, 
  fetchPopularMovies,
  fetchNowPlayingMovies,
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchAiringTodayTVShows,
  fetchOnTheAirTVShows
} from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";

const NewAndPopular = () => {
  const [newReleases, setNewReleases] = useState<TMDBMovie[]>([]);
  const [popularContent, setPopularContent] = useState<TMDBMovie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBMovie[]>([]);
  const [trendingShows, setTrendingShows] = useState<TMDBMovie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TMDBMovie[]>([]);
  const [airingToday, setAiringToday] = useState<TMDBMovie[]>([]);
  const [onTheAir, setOnTheAir] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Loading New & Popular content...');
        
        const [
          trending, 
          popular, 
          trulyUpcoming, 
          trendingTV, 
          nowPlayingMovies,
          airingTodayShows,
          onTheAirShows
        ] = await Promise.all([
          fetchTrendingMovies(),
          fetchPopularMovies(),
          getUpcomingMoviesOnly(), // Use the new function for truly upcoming movies
          fetchTrendingTVShows(),
          fetchNowPlayingMovies(),
          fetchAiringTodayTVShows(),
          fetchOnTheAirTVShows()
        ]);

        // Sort by release date for "new" content and filter valid items
        const sortedByDate = [...trending]
          .filter(movie => movie && movie.id && (movie.title || movie.name))
          .sort((a, b) => {
            const dateA = new Date(b.release_date || b.first_air_date || '').getTime();
            const dateB = new Date(a.release_date || a.first_air_date || '').getTime();
            return dateA - dateB;
          });

        setNewReleases(sortedByDate);
        setPopularContent(popular.filter(item => item && item.id));
        setUpcomingMovies(trulyUpcoming.filter(item => item && item.id));
        setTrendingShows(trendingTV.filter(item => item && item.id));
        setNowPlaying(nowPlayingMovies.filter(item => item && item.id));
        setAiringToday(airingTodayShows.filter(item => item && item.id));
        setOnTheAir(onTheAirShows.filter(item => item && item.id));
        
        console.log('New & Popular content loaded successfully');
      } catch (error) {
        console.error('Error loading New & Popular content:', error);
        setError('Failed to load content. Please try again later.');
        toast({
          title: "Error Loading Content",
          description: "Some content may not be available right now. Please try refreshing.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [toast]);

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center animate-fade-in">
        <Navigation />
        <div className="text-center glass-card p-8 rounded-2xl max-w-md mx-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white animate-fade-in">
      <Navigation />
      
      {/* Hero Header */}
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-900/20 via-transparent to-transparent"></div>
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-1/4 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">New & Popular</h1>
              <p className="text-gray-400 text-sm">What's trending and coming soon</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
              <Flame className="w-6 h-6 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-gray-400">Loading trending content...</p>
          </div>
        </div>
      )}
      
      {/* Content */}
      {!loading && (
        <div className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="space-y-10">
            {upcomingMovies.length > 0 && (
              <>
                <MovieCarousel 
                  title="Coming Soon" 
                  movies={upcomingMovies}
                  loading={loading}
                  icon={<Clock className="w-5 h-5 text-blue-400" />}
                  exploreAllPath="/browse/coming-soon"
                  comingSoon
                />
                <div className="section-divider" />
              </>
            )}

            {newReleases.length > 0 && (
              <>
                <MovieCarousel 
                  title="New Releases" 
                  movies={newReleases}
                  loading={loading}
                  icon={<Star className="w-5 h-5 text-yellow-400" />}
                  exploreAllPath="/browse/new-releases"
                />
                <div className="section-divider" />
              </>
            )}
            
            {nowPlaying.length > 0 && (
              <>
                <MovieCarousel 
                  title="Now Playing in Theaters" 
                  movies={nowPlaying}
                  loading={loading}
                  icon={<Star className="w-5 h-5 text-purple-400" />}
                  exploreAllPath="/browse/now-playing-theaters"
                />
                <div className="section-divider" />
              </>
            )}
            
            {airingToday.length > 0 && (
              <>
                <MovieCarousel 
                  title="Airing Today" 
                  movies={airingToday}
                  loading={loading}
                  icon={<Calendar className="w-5 h-5 text-green-400" />}
                  exploreAllPath="/browse/airing-today"
                />
                <div className="section-divider" />
              </>
            )}
            
            {popularContent.length > 0 && (
              <>
                <MovieCarousel 
                  title="Popular This Week" 
                  movies={popularContent}
                  loading={loading}
                  icon={<Flame className="w-5 h-5 text-orange-400" />}
                  exploreAllPath="/browse/popular-this-week"
                />
                <div className="section-divider" />
              </>
            )}
            
            {trendingShows.length > 0 && (
              <>
                <MovieCarousel 
                  title="Trending TV Shows" 
                  movies={trendingShows}
                  loading={loading}
                  icon={<Tv className="w-5 h-5 text-cyan-400" />}
                  exploreAllPath="/browse/trending-tv"
                />
                <div className="section-divider" />
              </>
            )}
            
            {onTheAir.length > 0 && (
              <MovieCarousel 
                title="On The Air" 
                movies={onTheAir}
                loading={loading}
                icon={<Radio className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/on-the-air"
              />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Stay up to date with the latest releases and trending content</p>
        </div>
      </footer>
    </div>
  );
};

export default NewAndPopular;

