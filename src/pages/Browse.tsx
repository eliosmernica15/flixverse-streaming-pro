import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import MovieCard from "@/components/MovieCard";
import { TMDBMovie } from "@/utils/tmdbApi";
import { getUpcomingMoviesOnly } from "@/utils/popularMoviesRotator";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchPopularMovies,
  fetchNowPlayingMovies,
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchAiringTodayTVShows,
  fetchOnTheAirTVShows,
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
  fetchActionTVShows,
  fetchComedyTVShows,
  fetchDramaTVShows,
  fetchSciFiTVShows,
  fetchCrimeTVShows,
  fetchDocumentaryTVShows,
  fetchTopRatedTVShows,
} from "@/utils/tmdbApi";
import { Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

type FetchFn = () => Promise<TMDBMovie[]>;

const BROWSE_CATEGORIES: Record<string, { title: string; fetch: FetchFn }> = {
  "new-releases": {
    title: "New Releases",
    fetch: async () => {
      const data = await fetchTrendingMovies();
      return [...data]
        .filter((m) => m && m.id && (m.title || m.name))
        .sort((a, b) => {
          const dateA = new Date(b.release_date || b.first_air_date || "").getTime();
          const dateB = new Date(a.release_date || a.first_air_date || "").getTime();
          return dateA - dateB;
        });
    },
  },
  "coming-soon": {
    title: "Coming Soon",
    fetch: getUpcomingMoviesOnly,
  },
  "trending-now": { title: "Trending Now", fetch: fetchTrendingMovies },
  "now-playing": { title: "Now Playing", fetch: fetchNowPlayingMovies },
  "top-rated": { title: "Top Rated", fetch: fetchTopRatedMovies },
  "popular-movies": { title: "Popular Movies", fetch: fetchPopularMovies },
  "trending-tv": { title: "Trending TV Shows", fetch: fetchTrendingTVShows },
  "popular-tv": { title: "Popular TV Shows", fetch: fetchPopularTVShows },
  "airing-today": { title: "Airing Today", fetch: fetchAiringTodayTVShows },
  "on-the-air": { title: "On The Air", fetch: fetchOnTheAirTVShows },
  "popular-this-week": { title: "Popular This Week", fetch: fetchPopularMovies },
  "now-playing-theaters": { title: "Now Playing in Theaters", fetch: fetchNowPlayingMovies },
  "top-rated-tv": { title: "Top Rated TV Shows", fetch: fetchTopRatedTVShows },
  // Movies page
  "trending-movies": { title: "Trending Movies", fetch: fetchTrendingMovies },
  "now-playing-movies": { title: "Now Playing", fetch: fetchNowPlayingMovies },
  "top-rated-movies": { title: "Top Rated Movies", fetch: fetchTopRatedMovies },
  action: { title: "Action", fetch: fetchActionMovies },
  comedy: { title: "Comedy", fetch: fetchComedyMovies },
  drama: { title: "Drama", fetch: fetchDramaMovies },
  thriller: { title: "Thriller", fetch: fetchThrillerMovies },
  horror: { title: "Horror", fetch: fetchHorrorMovies },
  "sci-fi": { title: "Sci-Fi", fetch: fetchSciFiMovies },
  fantasy: { title: "Fantasy", fetch: fetchFantasyMovies },
  adventure: { title: "Adventure", fetch: fetchAdventureMovies },
  animation: { title: "Animation", fetch: fetchAnimationMovies },
  romance: { title: "Romance", fetch: fetchRomanceMovies },
  upcoming: { title: "Coming Soon", fetch: getUpcomingMoviesOnly },
  // TV page
  "trending-tv-shows": { title: "Trending TV Shows", fetch: fetchTrendingTVShows },
  "airing-today-shows": { title: "Airing Today", fetch: fetchAiringTodayTVShows },
  "on-the-air-shows": { title: "On The Air", fetch: fetchOnTheAirTVShows },
  "popular-tv-shows": { title: "Popular TV Shows", fetch: fetchPopularTVShows },
  "action-adventure": { title: "Action & Adventure", fetch: fetchActionTVShows },
  "drama-series": { title: "Drama Series", fetch: fetchDramaTVShows },
  "comedy-shows": { title: "Comedy Shows", fetch: fetchComedyTVShows },
  "crime-mystery": { title: "Crime & Mystery", fetch: fetchCrimeTVShows },
  "sci-fi-fantasy": { title: "Sci-Fi & Fantasy", fetch: fetchSciFiTVShows },
  documentaries: { title: "Documentaries", fetch: fetchDocumentaryTVShows },
};

const normalizeMovie = (movie: TMDBMovie): TMDBMovie & { title: string; release_date: string } => ({
  ...movie,
  title: movie.title || movie.name || "",
  release_date: movie.release_date || movie.first_air_date || "",
});

const Browse = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = category ? BROWSE_CATEGORIES[category] : null;

  useEffect(() => {
    const cfg = category ? BROWSE_CATEGORIES[category] : null;
    if (!category || !cfg) {
      setLoading(false);
      if (category && !cfg) setError("Category not found");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    cfg
      .fetch()
      .then((data) => {
        if (cancelled) return;
        const valid = (data || []).filter(
          (m) => m && m.id && (m.title || m.name) && m.poster_path
        );
        setMovies(valid.map(normalizeMovie));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Browse fetch error:", err);
        setError("Failed to load content.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!category) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-gray-400 mb-4">No category specified.</p>
          <button
            onClick={() => navigate("/")}
            className="text-red-500 hover:text-red-400 font-medium"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-400 mb-4">Category not found.</p>
          <button
            onClick={() => navigate("/")}
            className="text-red-500 hover:text-red-400 font-medium"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white animate-fade-in">
      <Navigation />

      <div className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center gap-4 mb-10">
            <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-purple-500/10 rounded-xl border border-white/5">
              <Sparkles className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {config.title}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {movies.length} title{movies.length !== 1 ? "s" : ""}
              </p>
            </div>
          </header>

          {loading && (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-red-500 hover:text-red-400 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && movies.length > 0 && (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {movies.map((movie, index) => (
                <MovieCard 
                  key={`${movie.id}-${index}`} 
                  movie={movie} 
                  index={index} 
                  comingSoon={category === 'coming-soon' || category === 'upcoming'} 
                />
              ))}
            </motion.div>
          )}

          {!loading && !error && movies.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <p>No titles in this category right now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Browse;
