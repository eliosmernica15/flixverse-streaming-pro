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
  TMDBMovie,
} from "@/utils/tmdbApi";

type FetchFn = () => Promise<TMDBMovie[]>;

export const BROWSE_CATEGORIES: Record<string, { title: string; fetch: FetchFn }> = {
  "new-releases": {
    title: "New Releases",
    fetch: async () => {
      const data = await fetchTrendingMovies();
      return [...data]
        .filter((m) => m?.id && (m.title || m.name))
        .sort((a, b) => {
          const dateA = new Date(b.release_date || b.first_air_date || "").getTime();
          const dateB = new Date(a.release_date || a.first_air_date || "").getTime();
          return dateA - dateB;
        });
    },
  },
  "coming-soon": { title: "Coming Soon", fetch: getUpcomingMoviesOnly },
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

export const normalizeBrowseMovie = (
  movie: TMDBMovie
): TMDBMovie & { title: string; release_date: string } => ({
  ...movie,
  title: movie.title || movie.name || "",
  release_date: movie.release_date || movie.first_air_date || "",
});
