const TMDB_API_KEY = 'ee85a0945f4e5241324aed45e3f9c544';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1920_and_h800_multi_faces';

// TMDB image base URL - only use officially supported sizes to avoid 404s
// Supported poster sizes: w92, w154, w185, w342, w500, w780, original
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_POSTER_SIZES = {
  small: `${TMDB_IMAGE_BASE}/w185`,
  medium: `${TMDB_IMAGE_BASE}/w500`,
  large: `${TMDB_IMAGE_BASE}/w780`,
  original: `${TMDB_IMAGE_BASE}/original`
};

const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlZTg1YTA5NDVmNGU1MjQxMzI0YWVkNDVlM2Y5YzU0NCIsIm5iZiI6MTc1MDkzOTE5Ni4xMzQsInN1YiI6IjY4NWQzNjNjYWJjNjdlZTE1YTc0NDY5YSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.CU6hTLpFqLBKtx-GVPiby0UquV_iFWqAuiGGJn78m-o'
  }
};

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  tagline?: string;
  media_type?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TMDBSeason[];
  videos?: {
    results: {
      id: string;
      key: string;
      name: string;
      type: string;
      site: string;
    }[];
  };
  credits?: {
    cast: TMDBPerson[];
    crew: TMDBPerson[];
  };
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
  episode_count: number;
  air_date: string;
  episodes?: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number;
  vote_average: number;
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string;
  character?: string;
  job?: string;
  known_for_department?: string;
  known_for?: TMDBMovie[];
}

export interface TMDBGenre {
  id: number;
  name: string;
}

// Enhanced API calls with better error handling and retry logic
const apiCall = async (url: string, retries: number = 2): Promise<any> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`API Call attempt ${attempt + 1}: ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Resource not found (404): ${url}`);
          return { results: [], success: false, status_code: 404 };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`API Call successful: ${url}`);
      return { ...data, success: true };
    } catch (error) {
      console.error(`API call failed (attempt ${attempt + 1}):`, error);
      if (attempt === retries) {
        return { results: [], success: false, error: error.message };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

// Movie endpoints
export const fetchTrendingMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/trending/movie/week`);
  return data.results || [];
};

export const fetchTopRatedMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/top_rated`);
  return data.results || [];
};

export const fetchPopularMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/popular`);
  return data.results || [];
};

/** Upcoming movies (Coming soon) - uses TMDB movie/upcoming with language and page. */
export const fetchUpcomingMovies = async (page: number = 1): Promise<TMDBMovie[]> => {
  const data = await apiCall(
    `${TMDB_BASE_URL}/movie/upcoming?language=en-US&page=${page}`
  );
  return data.results || [];
};

export const fetchNowPlayingMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/now_playing`);
  return data.results || [];
};

// Genre-based movie fetching
export const fetchActionMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=28&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchComedyMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=35&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchHorrorMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=27&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchRomanceMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=10749&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchSciFiMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=878&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchDramaMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=18&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchThrillerMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=53&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchAnimationMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=16&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchFantasyMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=14&sort_by=popularity.desc`);
  return data.results || [];
};

export const fetchAdventureMovies = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=12&sort_by=popularity.desc`);
  return data.results || [];
};

// TV Show endpoints
export const fetchTrendingTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/trending/tv/week`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchPopularTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/popular`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchTopRatedTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/top_rated`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchAiringTodayTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/airing_today`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchOnTheAirTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/on_the_air`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

/** TV shows that have not premiered yet (first_air_date >= today). */
export const fetchUpcomingTVShows = async (): Promise<TMDBMovie[]> => {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiCall(
    `${TMDB_BASE_URL}/discover/tv?first_air_date.gte=${today}&sort_by=first_air_date.asc`
  );
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date,
    media_type: 'tv'
  }));
};

// Genre-based TV show fetching
export const fetchActionTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=10759&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchComedyTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=35&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchDramaTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=18&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchSciFiTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=10765&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchCrimeTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=80&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

export const fetchDocumentaryTVShows = async (): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=99&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

// Enhanced detail fetching with proper media type detection
export const fetchContentDetails = async (contentId: number, mediaType?: string): Promise<TMDBMovie | null> => {
  console.log(`Fetching content details for ID: ${contentId}, mediaType: ${mediaType}`);
  
  // If media type is specified, use it directly
  if (mediaType === 'movie') {
    return fetchMovieDetails(contentId);
  } else if (mediaType === 'tv') {
    return fetchTVShowDetails(contentId);
  }
  
  // Try to determine media type if not provided
  // First try as TV show (since the user clicked on a series)
  const tvResponse = await apiCall(`${TMDB_BASE_URL}/tv/${contentId}?append_to_response=videos,credits,seasons`);
  if (tvResponse.success && tvResponse.id) {
    console.log('Successfully fetched as TV show');
    return {
      ...tvResponse,
      title: tvResponse.name,
      release_date: tvResponse.first_air_date,
      media_type: 'tv'
    };
  }
  
  // Then try as movie
  const movieResponse = await apiCall(`${TMDB_BASE_URL}/movie/${contentId}?append_to_response=videos,credits`);
  if (movieResponse.success && movieResponse.id) {
    console.log('Successfully fetched as movie');
    return { ...movieResponse, media_type: 'movie' };
  }
  
  console.error('Failed to fetch content as both TV show and movie');
  return null;
};

export const fetchMovieDetails = async (movieId: number): Promise<TMDBMovie | null> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/${movieId}?append_to_response=videos,credits`);
  if (data.success && data.id) {
    return { ...data, media_type: 'movie' };
  }
  return null;
};

export const fetchTVShowDetails = async (tvId: number): Promise<TMDBMovie | null> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/${tvId}?append_to_response=videos,credits,seasons`);
  if (data.success && data.id) {
    return {
      ...data,
      title: data.name,
      release_date: data.first_air_date,
      media_type: 'tv'
    };
  }
  return null;
};

// New function to fetch TV show seasons and episodes
export const fetchTVSeasonDetails = async (tvId: number, seasonNumber: number): Promise<TMDBSeason | null> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`);
  return data.success && data.id ? data : null;
};

export const fetchTVSeasonEpisodes = async (tvId: number, seasonNumber: number): Promise<TMDBEpisode[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`);
  return data.success ? (data.episodes || []) : [];
};

// Person/Cast search
export const fetchPersonDetails = async (personId: number): Promise<TMDBPerson | null> => {
  const data = await apiCall(`${TMDB_BASE_URL}/person/${personId}?append_to_response=movie_credits,tv_credits`);
  return data.id ? data : null;
};

export const searchPeople = async (query: string): Promise<TMDBPerson[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(query)}`);
  return data.results || [];
};

// Recommendations
export const fetchMovieRecommendations = async (movieId: number): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/${movieId}/recommendations`);
  return data.results || [];
};

export const fetchTVShowRecommendations = async (tvId: number): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/${tvId}/recommendations`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

// Movie keywords (themes, topics) for similarity
export interface TMDBKeyword {
  id: number;
  name: string;
}

export const fetchMovieKeywords = async (movieId: number): Promise<TMDBKeyword[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/${movieId}/keywords`);
  return data.keywords || [];
};

// Discover movies by genres (OR) and optional keywords (AND) for candidate pool
export const discoverMoviesWithGenresAndKeywords = async (
  genreIds: number[],
  keywordIds: number[] = [],
  page: number = 1
): Promise<TMDBMovie[]> => {
  if (genreIds.length === 0) return [];
  const genreParam = genreIds.join('|');
  let url = `${TMDB_BASE_URL}/discover/movie?with_genres=${genreParam}&page=${page}&sort_by=popularity.desc`;
  if (keywordIds.length > 0) {
    url += `&with_keywords=${keywordIds.slice(0, 5).join(',')}`;
  }
  const data = await apiCall(url);
  return data.results || [];
};

// Similar content
export const fetchSimilarMovies = async (movieId: number): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/movie/${movieId}/similar`);
  return data.results || [];
};

export const fetchSimilarTVShows = async (tvId: number): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/tv/${tvId}/similar`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

// Genre fetching
export const fetchMovieGenres = async (): Promise<TMDBGenre[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/genre/movie/list`);
  return data.genres || [];
};

export const fetchTVGenres = async (): Promise<TMDBGenre[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/genre/tv/list`);
  return data.genres || [];
};

// Discover by genre
export const discoverMoviesByGenre = async (genreId: number, page: number = 1): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/movie?with_genres=${genreId}&page=${page}&sort_by=popularity.desc`);
  return data.results || [];
};

export const discoverTVShowsByGenre = async (genreId: number, page: number = 1): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/discover/tv?with_genres=${genreId}&page=${page}&sort_by=popularity.desc`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date
  }));
};

// Enhanced search functionality
export const searchMovies = async (query: string, page: number = 1): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${page}`);
  return data.results || [];
};

export const searchTVShows = async (query: string, page: number = 1): Promise<TMDBMovie[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&page=${page}`);
  return (data.results || []).map((show: any) => ({
    ...show,
    title: show.name,
    release_date: show.first_air_date,
    media_type: 'tv'
  }));
};

export const searchMulti = async (query: string, page: number = 1): Promise<any[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
  return (data.results || []).map((item: any) => ({
    ...item,
    title: item.title || item.name,
    release_date: item.release_date || item.first_air_date
  }));
};

export interface SearchMultiResponse {
  results: any[];
  page: number;
  total_pages: number;
  total_results: number;
}

export const searchMultiWithPagination = async (
  query: string,
  page: number = 1
): Promise<SearchMultiResponse> => {
  const data = await apiCall(
    `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(query)}&page=${page}`
  );
  const results = (data.results || []).map((item: any) => ({
    ...item,
    media_type: item.media_type || (item.title ? "movie" : "tv"),
    title: item.title || item.name,
    release_date: item.release_date || item.first_air_date,
  }));
  return {
    results,
    page: data.page ?? 1,
    total_pages: Math.min(data.total_pages ?? 1, 500),
    total_results: data.total_results ?? 0,
  };
};

// Trending content by time window
export const fetchTrendingAll = async (timeWindow: 'day' | 'week' = 'week'): Promise<any[]> => {
  const data = await apiCall(`${TMDB_BASE_URL}/trending/all/${timeWindow}`);
  return (data.results || []).map((item: any) => ({
    ...item,
    title: item.title || item.name,
    release_date: item.release_date || item.first_air_date
  }));
};

// Enhanced image utilities with better fallbacks
export const getImageUrl = (path: string | null, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string => {
  if (!path || typeof path !== 'string') {
    return getPlaceholderImage();
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_POSTER_SIZES[size]}${normalizedPath}`;
};

export const getBackdropUrl = (path: string | null, size: 'small' | 'medium' | 'large' | 'original' = 'large'): string => {
  if (!path || typeof path !== 'string') {
    return getPlaceholderBackdrop();
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const backdropSizes = {
    small: `${TMDB_IMAGE_BASE}/w780`,
    medium: `${TMDB_IMAGE_BASE}/w1280`,
    large: `${TMDB_IMAGE_BASE}/w1920_and_h800_multi_faces`,
    original: `${TMDB_IMAGE_BASE}/original`
  };
  return `${backdropSizes[size]}${normalizedPath}`;
};

export const getProfileUrl = (path: string | null, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string => {
  if (!path || typeof path !== 'string') {
    return getPlaceholderProfile();
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const profileSizes = {
    small: `${TMDB_IMAGE_BASE}/w185`,
    medium: `${TMDB_IMAGE_BASE}/w342`,
    large: `${TMDB_IMAGE_BASE}/w500`,
    original: `${TMDB_IMAGE_BASE}/original`
  };
  return `${profileSizes[size]}${normalizedPath}`;
};

export const getPlaceholderImage = (): string => {
  const placeholders = [
    'https://images.unsplash.com/photo-1489599735161-8f4b80604bb9?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-b0a8d129c8f4?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1574267432644-56f4b59b7a09?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=450&fit=crop',
    'https://images.unsplash.com/photo-1586899028174-e7098604235b?w=300&h=450&fit=crop'
  ];
  return placeholders[Math.floor(Math.random() * placeholders.length)];
};

export const getPlaceholderBackdrop = (): string => {
  const placeholders = [
    'https://images.unsplash.com/photo-1489599735161-8f4b80604bb9?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-b0a8d129c8f4?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1574267432644-56f4b59b7a09?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1586899028174-e7098604235b?w=1920&h=1080&fit=crop'
  ];
  return placeholders[Math.floor(Math.random() * placeholders.length)];
};

export const getPlaceholderProfile = (): string => {
  const placeholders = [
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108755-2616c30ca842?w=300&h=300&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1500648767791-3dcbd9c5a5c9?w=300&h=300&fit=crop&crop=face'
  ];
  return placeholders[Math.floor(Math.random() * placeholders.length)];
};

// Utility function to get the appropriate image for any content type
export const getContentImage = (item: any, imageType: 'poster' | 'backdrop' | 'profile' = 'poster', size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string => {
  if (imageType === 'poster' && item.poster_path) {
    return getImageUrl(item.poster_path, size);
  }
  if (imageType === 'backdrop' && item.backdrop_path) {
    return getBackdropUrl(item.backdrop_path, size);
  }
  if (imageType === 'profile' && item.profile_path) {
    return getProfileUrl(item.profile_path, size);
  }
  
  // Fallback to any available image
  if (item.poster_path) return getImageUrl(item.poster_path, size);
  if (item.backdrop_path) return getBackdropUrl(item.backdrop_path, size);
  if (item.profile_path) return getProfileUrl(item.profile_path, size);
  
  // Return appropriate placeholder
  switch (imageType) {
    case 'backdrop':
      return getPlaceholderBackdrop();
    case 'profile':
      return getPlaceholderProfile();
    default:
      return getPlaceholderImage();
  }
};

// Utility function to safely get content title
export const getContentTitle = (item: TMDBMovie): string => {
  return item.title || item.name || 'Unknown Title';
};

// Utility function to safely get content release date
export const getContentReleaseDate = (item: TMDBMovie): string => {
  return item.release_date || item.first_air_date || '';
};

/** True if the movie/TV has a release/first_air date in the future (not yet released). */
export const isNotReleasedYet = (item: TMDBMovie): boolean => {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr > today;
};

// Utility function to detect content type
export const getContentType = (item: TMDBMovie): 'movie' | 'tv' => {
  if (item.media_type) {
    return item.media_type as 'movie' | 'tv';
  }
  // Fallback detection based on properties
  if (item.title && item.release_date) return 'movie';
  if (item.name && item.first_air_date) return 'tv';
  if (item.number_of_seasons) return 'tv';
  return 'movie'; // default fallback
};
