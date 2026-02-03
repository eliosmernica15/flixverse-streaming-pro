"use client";


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
  const [showsData, setShowsData] = useState<{ [key: string]: TMDBMovie[] }>({});
  const [loading, setLoading] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const loadTVShows = async () => {
      setLoading(true);
      setErrorCount(0);

      const sections = [
        { id: 'trending', fetch: fetchTrendingTVShows },
        { id: 'popular', fetch: fetchPopularTVShows },
        { id: 'topRated', fetch: fetchTopRatedTVShows },
        { id: 'airingToday', fetch: fetchAiringTodayTVShows },
        { id: 'onTheAir', fetch: fetchOnTheAirTVShows },
        { id: 'action', fetch: fetchActionTVShows },
        { id: 'comedy', fetch: fetchComedyTVShows },
        { id: 'drama', fetch: fetchDramaTVShows },
        { id: 'sciFi', fetch: fetchSciFiTVShows },
        { id: 'crime', fetch: fetchCrimeTVShows },
        { id: 'documentary', fetch: fetchDocumentaryTVShows }
      ];

      // Batching for mobile stability
      const batchSize = 3;
      for (let i = 0; i < sections.length; i += batchSize) {
        const batch = sections.slice(i, i + batchSize);
        try {
          const results = await Promise.all(
            batch.map(async (s) => ({ id: s.id, data: await s.fetch() }))
          );

          setShowsData(prev => {
            const next = { ...prev };
            results.forEach(r => {
              if (r.data && r.data.length > 0) {
                next[r.id] = r.data;
              }
            });
            return next;
          });
        } catch (err) {
          console.error(`TV Batch ${i / batchSize} failed:`, err);
          setErrorCount(prev => prev + 1);
        }

        if (i + batchSize < sections.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setLoading(false);
    };

    loadTVShows();
  }, []);

  if (loading && Object.keys(showsData).length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <Tv className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400">Discovering TV Shows...</p>
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
          {showsData['trending'] && (
            <>
              <MovieCarousel
                title="Trending TV Shows"
                movies={showsData['trending']}
                icon={<Flame className="w-5 h-5 text-orange-400" />}
                exploreAllPath="/browse/trending-tv-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['airingToday'] && (
            <>
              <MovieCarousel
                title="Airing Today"
                movies={showsData['airingToday']}
                icon={<Calendar className="w-5 h-5 text-green-400" />}
                exploreAllPath="/browse/airing-today-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['onTheAir'] && (
            <>
              <MovieCarousel
                title="On The Air"
                movies={showsData['onTheAir']}
                icon={<Radio className="w-5 h-5 text-red-400" />}
                exploreAllPath="/browse/on-the-air-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['popular'] && (
            <>
              <MovieCarousel
                title="Popular TV Shows"
                movies={showsData['popular']}
                icon={<Flame className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/popular-tv-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['topRated'] && (
            <>
              <MovieCarousel
                title="Top Rated TV Shows"
                movies={showsData['topRated']}
                icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                exploreAllPath="/browse/top-rated-tv"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['action'] && (
            <>
              <MovieCarousel
                title="Action & Adventure"
                movies={showsData['action']}
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                exploreAllPath="/browse/action-adventure"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['drama'] && (
            <>
              <MovieCarousel
                title="Drama Series"
                movies={showsData['drama']}
                icon={<Drama className="w-5 h-5 text-blue-400" />}
                exploreAllPath="/browse/drama-series"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['comedy'] && (
            <>
              <MovieCarousel
                title="Comedy Shows"
                movies={showsData['comedy']}
                icon={<Laugh className="w-5 h-5 text-pink-400" />}
                exploreAllPath="/browse/comedy-shows"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['crime'] && (
            <>
              <MovieCarousel
                title="Crime & Mystery"
                movies={showsData['crime']}
                icon={<Search className="w-5 h-5 text-gray-400" />}
                exploreAllPath="/browse/crime-mystery"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['sciFi'] && (
            <>
              <MovieCarousel
                title="Sci-Fi & Fantasy"
                movies={showsData['sciFi']}
                icon={<Rocket className="w-5 h-5 text-cyan-400" />}
                exploreAllPath="/browse/sci-fi-fantasy"
              />
              <div className="section-divider" />
            </>
          )}

          {showsData['documentary'] && (
            <MovieCarousel
              title="Documentaries"
              movies={showsData['documentary']}
              icon={<FileText className="w-5 h-5 text-emerald-400" />}
              exploreAllPath="/browse/documentaries"
            />
          )}

          {/* No content message */}
          {!loading && Object.keys(showsData).length === 0 && (
            <div className="text-center py-12 glass-card rounded-2xl max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tv className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No TV shows available</h3>
              <p className="text-gray-400 mb-6">Please try again in a moment</p>
              <button
                onClick={() => window.location.reload()}
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
