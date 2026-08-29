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

export type BrowseMenuColumn = {
  id: "movies" | "tv" | "collections" | "moods";
  links: { slug: string; title: string }[];
};

export const BROWSE_MEGA_MENU: BrowseMenuColumn[] = [
  {
    id: "movies",
    links: [
      { slug: "action", title: "Action" },
      { slug: "comedy", title: "Comedy" },
      { slug: "drama", title: "Drama" },
      { slug: "thriller", title: "Thriller" },
      { slug: "horror", title: "Horror" },
      { slug: "sci-fi", title: "Sci-Fi" },
      { slug: "fantasy", title: "Fantasy" },
      { slug: "adventure", title: "Adventure" },
      { slug: "animation", title: "Animation" },
      { slug: "romance", title: "Romance" },
    ],
  },
  {
    id: "tv",
    links: [
      { slug: "trending-tv", title: "Trending TV" },
      { slug: "popular-tv", title: "Popular TV" },
      { slug: "action-adventure", title: "Action & Adventure" },
      { slug: "drama-series", title: "Drama Series" },
      { slug: "comedy-shows", title: "Comedy Shows" },
      { slug: "crime-mystery", title: "Crime & Mystery" },
      { slug: "sci-fi-fantasy", title: "Sci-Fi & Fantasy" },
      { slug: "documentaries", title: "Documentaries" },
    ],
  },
  {
    id: "collections",
    links: [
      { slug: "trending-now", title: "Trending Now" },
      { slug: "now-playing", title: "Now Playing" },
      { slug: "top-rated", title: "Top Rated" },
      { slug: "coming-soon", title: "Coming Soon" },
      { slug: "airing-today", title: "Airing Today" },
      { slug: "new-releases", title: "New Releases" },
    ],
  },
  {
    id: "moods",
    links: [
      { slug: "comedy", title: "Feel-good" },
      { slug: "thriller", title: "Heart-pounding" },
      { slug: "horror", title: "Spine-chilling" },
      { slug: "sci-fi", title: "Out of this world" },
      { slug: "adventure", title: "Epic" },
      { slug: "romance", title: "Love stories" },
    ],
  },
];

/** Maps names stored in userPreferences.favoriteGenres → browse category slugs. */
export const FAVORITE_GENRE_BROWSE: Record<string, string> = {
  Action: "action",
  Comedy: "comedy",
  Drama: "drama",
  Horror: "horror",
  Romance: "romance",
  "Sci-Fi": "sci-fi",
  Thriller: "thriller",
  Animation: "animation",
  Fantasy: "fantasy",
  Adventure: "adventure",
  Crime: "crime-mystery",
  Documentary: "documentaries",
};

export const normalizeBrowseMovie = (
  movie: TMDBMovie
): TMDBMovie & { title: string; release_date: string } => ({
  ...movie,
  title: movie.title || movie.name || "",
  release_date: movie.release_date || movie.first_air_date || "",
});
