"use client";


import { useState, useEffect } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import MovieCarousel from "@/components/MovieCarousel";
import { fetchMovieDetails, fetchTVShowDetails, TMDBMovie } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { Heart, LogIn, Film, Plus, Sparkles } from "lucide-react";

const MyList = () => {
  const [myMovies, setMyMovies] = useState<TMDBMovie[]>([]);
  const { isAuthenticated } = useAuth();
  const { movieList, loading: listLoading } = useUserMovieList();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMyList = async () => {
      if (!isAuthenticated || movieList.length === 0) {
        setMyMovies([]);
        setLoading(false);
        return;
      }

      try {
        const moviePromises = movieList.map((item) => {
          if (item.media_type === 'tv') {
            return fetchTVShowDetails(item.movie_id);
          }
          return fetchMovieDetails(item.movie_id);
        });
        const movies = await Promise.all(moviePromises);
        const validMovies = movies.filter(movie => movie !== null) as TMDBMovie[];

        setMyMovies(validMovies);
      } catch (error) {
        console.error('Error loading movie details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!listLoading) {
      loadMyList();
    }
  }, [isAuthenticated, movieList, listLoading]);

  if (loading || listLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            <Heart className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400">Loading your list...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white animate-fade-in">
        <Navigation />

        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <LogIn className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Sign In Required</h1>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Create an account or sign in to save your favorite movies and TV shows to your personal list.
            </p>
            <Link href="/auth">
              <button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 shadow-xl shadow-red-500/20">
                Sign In / Sign Up
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white animate-fade-in">
      <Navigation />

      {/* Hero Header */}
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-900/20 via-transparent to-transparent"></div>
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">My List</h1>
              <p className="text-gray-400 text-sm">
                {myMovies.length > 0
                  ? `${myMovies.length} title${myMovies.length > 1 ? 's' : ''} saved`
                  : 'Your personal watchlist'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        {myMovies.length > 0 ? (
          <MovieCarousel
            title="Your Saved Titles"
            movies={myMovies}
            icon={<Sparkles className="w-5 h-5 text-yellow-400" />}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="glass-card p-12 rounded-3xl max-w-lg text-center">
              <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Film className="w-10 h-10 text-gray-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Your list is empty</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Start building your personal watchlist by adding movies and TV shows you want to watch later.
              </p>
              <Link href="/">
                <button className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105">
                  <Plus className="w-5 h-5" />
                  <span>Discover Movies</span>
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Save your favorites and never lose track of what to watch next</p>
        </div>
      </footer>
    </div>
  );
};

export default MyList;
