
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import MovieCarousel from "@/components/MovieCarousel";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tv, Flame, Trophy, Calendar, Radio, Zap, Laugh, Drama, Search, Rocket, FileText, AlertCircle } from "lucide-react";
import {
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchTopRatedTVShows,
  fetchAiringTodayTVShows,
  fetchOnTheAirTVShows,
  fetchActionTVShows,
  fetchComedyTVShows,
  fetchDramaTVShows,
  fetchSciFiTVShows,
  fetchCrimeTVShows,
  fetchDocumentaryTVShows,
  TMDBMovie
} from "@/utils/tmdbApi";

const TVShows = () => {
  const [trendingShows, setTrendingShows] = useState<TMDBMovie[]>([]);
  const [popularShows, setPopularShows] = useState<TMDBMovie[]>([]);
  const [topRatedShows, setTopRatedShows] = useState<TMDBMovie[]>([]);
  const [airingTodayShows, setAiringTodayShows] = useState<TMDBMovie[]>([]);
  const [onTheAirShows, setOnTheAirShows] = useState<TMDBMovie[]>([]);
  const [actionShows, setActionShows] = useState<TMDBMovie[]>([]);
  const [comedyShows, setComedyShows] = useState<TMDBMovie[]>([]);
  const [dramaShows, setDramaShows] = useState<TMDBMovie[]>([]);
  const [sciFiShows, setSciFiShows] = useState<TMDBMovie[]>([]);
  const [crimeShows, setCrimeShows] = useState<TMDBMovie[]>([]);
  const [documentaryShows, setDocumentaryShows] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTVShows = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading TV shows...');

        const [
          trending,
          popular,
          topRated,
          airingToday,
          onTheAir,
          action,
          comedy,
          drama,
          sciFi,
          crime,
          documentary
        ] = await Promise.all([
          fetchTrendingTVShows(),
          fetchPopularTVShows(),
          fetchTopRatedTVShows(),
          fetchAiringTodayTVShows(),
          fetchOnTheAirTVShows(),
          fetchActionTVShows(),
          fetchComedyTVShows(),
          fetchDramaTVShows(),
          fetchSciFiTVShows(),
          fetchCrimeTVShows(),
          fetchDocumentaryTVShows()
        ]);

        console.log('TV shows loaded:', {
          trending: trending?.length || 0,
          popular: popular?.length || 0,
          topRated: topRated?.length || 0,
          airingToday: airingToday?.length || 0,
          onTheAir: onTheAir?.length || 0
        });

        setTrendingShows(trending || []);
        setPopularShows(popular || []);
        setTopRatedShows(topRated || []);
        setAiringTodayShows(airingToday || []);
        setOnTheAirShows(onTheAir || []);
        setActionShows(action || []);
        setComedyShows(comedy || []);
        setDramaShows(drama || []);
        setSciFiShows(sciFi || []);
        setCrimeShows(crime || []);
        setDocumentaryShows(documentary || []);
      } catch (error) {
        console.error('Error loading TV shows:', error);
        setError('Failed to load TV shows. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTVShows();
  }, []);

  const retryLoading = () => {
    setError(null);
    setLoading(true);
    // Re-trigger the useEffect
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            <Tv className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400">Loading TV Shows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md mx-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={retryLoading}
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
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent"></div>
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">TV Shows</h1>
              <p className="text-gray-400 text-sm">Binge-worthy series for every mood</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-10">
          {trendingShows.length > 0 && (
            <>
              <MovieCarousel
                title="Trending TV Shows"
                movies={trendingShows}
                icon={<Flame className="w-5 h-5 text-orange-400" />}
                exploreAllPath="/browse/trending-tv-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {airingTodayShows.length > 0 && (
            <>
              <MovieCarousel
                title="Airing Today"
                movies={airingTodayShows}
                icon={<Calendar className="w-5 h-5 text-green-400" />}
                exploreAllPath="/browse/airing-today-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {onTheAirShows.length > 0 && (
            <>
              <MovieCarousel
                title="On The Air"
                movies={onTheAirShows}
                icon={<Radio className="w-5 h-5 text-red-400" />}
                exploreAllPath="/browse/on-the-air-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {popularShows.length > 0 && (
            <>
              <MovieCarousel
                title="Popular TV Shows"
                movies={popularShows}
                icon={<Flame className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/popular-tv-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {topRatedShows.length > 0 && (
            <>
              <MovieCarousel
                title="Top Rated TV Shows"
                movies={topRatedShows}
                icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                exploreAllPath="/browse/top-rated-tv"
              />
              <div className="section-divider" />
            </>
          )}

          {actionShows.length > 0 && (
            <>
              <MovieCarousel
                title="Action & Adventure"
                movies={actionShows}
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                exploreAllPath="/browse/action-adventure"
              />
              <div className="section-divider" />
            </>
          )}

          {dramaShows.length > 0 && (
            <>
              <MovieCarousel
                title="Drama Series"
                movies={dramaShows}
                icon={<Drama className="w-5 h-5 text-blue-400" />}
                exploreAllPath="/browse/drama-series"
              />
              <div className="section-divider" />
            </>
          )}

          {comedyShows.length > 0 && (
            <>
              <MovieCarousel
                title="Comedy Shows"
                movies={comedyShows}
                icon={<Laugh className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/comedy-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {crimeShows.length > 0 && (
            <>
              <MovieCarousel
                title="Crime & Mystery"
                movies={crimeShows}
                icon={<Search className="w-5 h-5 text-gray-400" />}
                exploreAllPath="/browse/crime-mystery"
              />
              <div className="section-divider" />
            </>
          )}

          {sciFiShows.length > 0 && (
            <>
              <MovieCarousel
                title="Sci-Fi & Fantasy"
                movies={sciFiShows}
                icon={<Rocket className="w-5 h-5 text-cyan-400" />}
                exploreAllPath="/browse/sci-fi-fantasy"
              />
              <div className="section-divider" />
            </>
          )}

          {documentaryShows.length > 0 && (
            <MovieCarousel
              title="Documentaries"
              movies={documentaryShows}
              icon={<FileText className="w-5 h-5 text-emerald-400" />}
              exploreAllPath="/browse/documentaries"
            />
          )}

          {/* No content message */}
          {!trendingShows.length && !popularShows.length && !topRatedShows.length &&
            !airingTodayShows.length && !onTheAirShows.length && !actionShows.length &&
            !comedyShows.length && !dramaShows.length && !crimeShows.length &&
            !sciFiShows.length && !documentaryShows.length && (
              <div className="text-center py-12 glass-card rounded-2xl max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Tv className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No TV shows available</h3>
                <p className="text-gray-400 mb-6">Please try again in a moment</p>
                <button
                  onClick={retryLoading}
                  className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-2 rounded-full font-semibold hover:scale-105 transition-all"
                >
                  Reload
                </button>
              </div>
            )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TVShows;
