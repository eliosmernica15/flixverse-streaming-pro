import { fetchTrendingMovies, fetchPopularMovies, fetchTrendingTVShows, TMDBMovie } from './tmdbApi';

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

// Function to get truly upcoming movies (not yet released)
export const getUpcomingMoviesOnly = async (): Promise<TMDBMovie[]> => {
  try {
    const { fetchUpcomingMovies } = await import('./tmdbApi');
    const upcomingMovies = await fetchUpcomingMovies();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter for movies that haven't been released yet
    const trulyUpcoming = upcomingMovies.filter(movie => {
      if (!movie.release_date) return false;
      
      const releaseDate = new Date(movie.release_date);
      releaseDate.setHours(0, 0, 0, 0);
      
      return releaseDate > today;
    });

    // Sort by release date (closest first)
    trulyUpcoming.sort((a, b) => {
      const dateA = new Date(a.release_date || '').getTime();
      const dateB = new Date(b.release_date || '').getTime();
      return dateA - dateB;
    });

    return trulyUpcoming;
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return [];
  }
};