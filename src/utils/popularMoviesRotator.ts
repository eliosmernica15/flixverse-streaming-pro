import { fetchTrendingMovies, fetchPopularMovies, fetchTrendingTVShows, TMDBMovie, isNotReleasedYet } from './tmdbApi';

// Function to get the current week number
const getWeekNumber = (date: Date): number => {
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil(days / 7);
};

// Function to get popular content for hero banner that rotates weekly
export const getHeroMovieOfTheWeek = async (): Promise<TMDBMovie | null> => {
  try {
    // Get current week to determine which content to show
    const currentWeek = getWeekNumber(new Date());
    
    // Fetch all popular content
    const [trendingMovies, popularMovies, trendingShows] = await Promise.all([
      fetchTrendingMovies(),
      fetchPopularMovies(),
      fetchTrendingTVShows()
    ]);

    // Combine all content and filter for high-quality entries
    const allContent = [
      ...trendingMovies.filter(movie => movie.vote_average >= 7.0 && movie.backdrop_path),
      ...popularMovies.filter(movie => movie.vote_average >= 7.0 && movie.backdrop_path),
      ...trendingShows.filter(show => show.vote_average >= 7.0 && show.backdrop_path)
    ];

    if (allContent.length === 0) return null;

    // Use week number to select content (rotates weekly)
    const selectedIndex = currentWeek % allContent.length;
    const selectedMovie = allContent[selectedIndex];

    return selectedMovie;
  } catch (error) {
    console.error('Error fetching hero movie:', error);
    return null;
  }
};

// Function to get truly upcoming movies and TV (not yet released - cannot play)
export const getUpcomingMoviesOnly = async (): Promise<TMDBMovie[]> => {
  try {
    const { fetchUpcomingMovies, fetchUpcomingTVShows } = await import('./tmdbApi');
    const [upcomingMovies, upcomingTV] = await Promise.all([
      fetchUpcomingMovies(),
      fetchUpcomingTVShows(),
    ]);

    // Filter for content that hasn't been released yet (not showing to public)
    const notReleasedMovies = (upcomingMovies || []).filter(isNotReleasedYet);
    const notReleasedTV = (upcomingTV || []).filter(isNotReleasedYet);

    const combined = [...notReleasedMovies, ...notReleasedTV];

    // Sort by release date (closest first)
    combined.sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || '';
      const dateB = b.release_date || b.first_air_date || '';
      return dateA.localeCompare(dateB);
    });

    return combined;
  } catch (error) {
    console.error('Error fetching upcoming content:', error);
    return [];
  }
};