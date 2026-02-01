
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, Star, X, Heart, Calendar, Clock, Users, ArrowLeft, Tv, Film, ChevronDown, PlayCircle } from "lucide-react";
import { fetchContentDetails, getImageUrl, getBackdropUrl, TMDBMovie, TMDBSeason } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { useAuth } from "@/hooks/useAuth";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import VideoPlayer from "./VideoPlayer";
import ReviewSection from "./ReviewSection";
import CommentSection from "./CommentSection";
import QuickRating from "./QuickRating";

interface MovieDetailsProps {
  movieId: number;
  mediaType?: "movie" | "tv";
  onClose: () => void;
  autoplay?: boolean;
  resumePosition?: number;
  initialSeason?: number;
  initialEpisode?: number;
}

const MovieDetails = ({ movieId, mediaType, onClose, autoplay = false, resumePosition, initialSeason, initialEpisode }: MovieDetailsProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [content, setContent] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason || 1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode || 1);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieList();
  const { getProgress } = useWatchHistory();

  useEffect(() => {
    let isMounted = true;

    const loadContentDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Loading content details for ID: ${movieId}, Type: ${mediaType}`);
        
        const contentData = await fetchContentDetails(movieId, mediaType);
        
        if (!isMounted) return;
        
        if (!contentData) {
          setError('Content not found');
          setLoading(false);
          return;
        }

        console.log('Content loaded successfully:', contentData);
        setContent(contentData);
        
      } catch (err) {
        console.error('Error loading content details:', err);
        if (isMounted) {
          setError('Failed to load content details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadContentDetails();
    
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      if (isMounted) setIsVisible(true);
    }, 10);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [movieId, mediaType]);

  // Handle autoplay
  useEffect(() => {
    if (autoplay && content && !showPlayer) {
      // Small delay to ensure content is fully loaded
      const timer = setTimeout(() => {
        setShowPlayer(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoplay, content, showPlayer]);

  // No body scroll lock needed - component has its own scroll container

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  // When user closes the video player (X or Escape), close and remove autoplay from URL
  // so the autoplay effect doesn't reopen the player after 500ms.
  const handleClosePlayer = () => {
    setShowPlayer(false);
    const params = new URLSearchParams(location.search);
    if (params.has('autoplay') || params.has('resume')) {
      params.delete('autoplay');
      params.delete('resume');
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
    }
  };

  const handleAddToList = async () => {
    if (!content) return;
    
    const contentTitle = content?.title || content?.name || 'Unknown';
    
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to your list.",
        variant: "destructive",
      });
      return;
    }

    const isCurrentlyInList = isInList(movieId);
    
    try {
      if (isCurrentlyInList) {
        await removeFromList(movieId);
        toast({
          title: "Removed from My List",
          description: `${contentTitle} has been removed from your list.`,
        });
      } else {
        const movieData: TMDBMovie = {
          ...content,
          id: movieId,
          media_type: mediaType || (content.first_air_date ? 'tv' : 'movie'),
        };
        await addToList(movieData);
        toast({
          title: "Added to My List",
          description: `${contentTitle} has been added to your list.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update your list.",
        variant: "destructive",
      });
    }
  };

  const handleWatch = (episode?: number) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in or sign up to watch movies and TV shows.",
        variant: "destructive",
      });
      // Redirect to auth page after a short delay
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
      return;
    }

    const contentTitle = content?.title || content?.name || 'Unknown';
    const isTVShow = content?.media_type === 'tv' || mediaType === 'tv';
    const episodeToPlay = episode || selectedEpisode;
    
    if (isTVShow) {
      console.log(`Starting to watch: ${contentTitle} S${selectedSeason}E${episodeToPlay}`);
      setSelectedEpisode(episodeToPlay);
    } else {
      console.log('Starting to watch:', contentTitle);
    }
    
    setShowPlayer(true);
    toast({
      title: "Now Playing",
      description: isTVShow 
        ? `Loading ${contentTitle} - Season ${selectedSeason}, Episode ${episodeToPlay}...`
        : `Loading ${contentTitle}...`,
    });
  };

  const handleWatchTrailer = () => {
    const trailer = content?.videos?.results.find(video => 
      video.type === 'Trailer' && video.site === 'YouTube'
    );
    const contentTitle = content?.title || content?.name || 'Unknown';
    
    if (trailer) {
      window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
      toast({
        title: "Trailer Playing",
        description: `Opening ${contentTitle} trailer...`,
      });
    } else {
      toast({
        title: "No Trailer Available",
        description: `Sorry, no trailer found for ${contentTitle}`,
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    const contentTitle = content?.title || content?.name || 'Unknown';
    console.log('Starting download for:', contentTitle);
    
    toast({
      title: "Download Started",
      description: `${contentTitle} download has been initiated. (Demo mode)`,
    });
    
    setTimeout(() => {
      toast({
        title: "Download Complete",
        description: `${contentTitle} has been downloaded successfully.`,
      });
    }, 3000);
  };

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black z-[9999] flex items-center justify-center transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className={`fixed inset-0 bg-black z-[9999] flex items-center justify-center transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-center glass-card p-8 rounded-2xl max-w-md mx-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">{error || 'Content not found'}</h2>
          <p className="text-gray-400 mb-6">We couldn't load this content. Please try again.</p>
          <button 
            onClick={handleClose}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const trailer = content.videos?.results.find(video => 
    video.type === 'Trailer' && video.site === 'YouTube'
  );

  const contentTitle = content.title || content.name || 'Unknown';
  const releaseDate = content.release_date || content.first_air_date;
  const isTV = content.media_type === 'tv' || mediaType === 'tv';

  return (
    <div 
      className={`min-h-screen w-full bg-black transition-all duration-500 ease-out overflow-x-hidden ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="relative w-full">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleClose}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 z-[999] flex items-center space-x-2 px-3 sm:px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:-translate-x-1 transition-transform" />
          <span className="text-white text-xs sm:text-sm font-medium">Back</span>
        </button>

        {/* Hero Section */}
        <div className="relative min-h-screen w-full flex flex-col">
          {/* Background with Ken Burns effect */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
            style={{ 
              backgroundImage: `url(${getBackdropUrl(content.backdrop_path)})`,
              animation: 'kenburns 25s ease-in-out infinite alternate'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent"></div>
          </div>

          {/* Content */}
          <div className={`relative z-10 flex flex-col justify-center min-h-screen w-full px-4 sm:px-6 md:px-12 lg:px-20 py-20 sm:py-24 transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="max-w-4xl w-full">
              {/* Content Type Badge */}
              <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                <span className="inline-flex items-center space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wider">
                  {isTV ? <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Film className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  <span>{isTV ? 'TV Series' : 'Movie'}</span>
                </span>
                {content.vote_average > 7.5 && (
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs font-bold rounded-full">
                    ⭐ Top Rated
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black mb-3 sm:mb-4 text-white leading-[1.1] tracking-tight">
                {contentTitle}
              </h1>
              
              {/* Tagline */}
              {content.tagline && (
                <p className="text-lg md:text-xl text-gray-400 mb-6 italic font-light">{content.tagline}</p>
              )}
              
              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center space-x-1.5 bg-yellow-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-yellow-400 font-bold">{content.vote_average.toFixed(1)}</span>
                </div>
                {releaseDate && (
                  <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(releaseDate).getFullYear()}</span>
                  </span>
                )}
                {content.runtime && (
                  <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{Math.floor(content.runtime / 60)}h {content.runtime % 60}m</span>
                  </span>
                )}
                {isTV && content.number_of_seasons && (
                  <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    <Users className="w-3.5 h-3.5" />
                    <span>{content.number_of_seasons} Season{content.number_of_seasons > 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>

              {/* Genres */}
              {content.genres && content.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {content.genres.map((genre) => (
                    <span key={genre.id} className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 text-sm rounded-full">
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              <p className="text-sm sm:text-base md:text-lg text-gray-300 mb-6 sm:mb-10 max-w-3xl leading-relaxed">
                {content.overview}
              </p>

              {/* TV Show Season/Episode Selector - In Hero */}
              {isTV && content.seasons && content.seasons.length > 0 && (
                <div className="mb-6 sm:mb-8 w-full max-w-2xl bg-black/40 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-white/10">
                  {/* Season & Episode Row */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Season Selector */}
                    <div className="flex-1">
                      <label className="block text-gray-400 text-xs sm:text-sm mb-1.5 sm:mb-2">Season</label>
                      <select
                        value={selectedSeason}
                        onChange={(e) => {
                          setSelectedSeason(Number(e.target.value));
                          setSelectedEpisode(1);
                        }}
                        className="w-full bg-white/10 border border-white/20 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-lg font-semibold appearance-none cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                      >
                        {content.seasons
                          .filter(season => season.season_number > 0)
                          .map((season) => (
                            <option key={season.id} value={season.season_number} className="bg-gray-900 text-white">
                              Season {season.season_number} ({season.episode_count} eps)
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Episode Selector */}
                    <div className="flex-1">
                      <label className="block text-gray-400 text-xs sm:text-sm mb-1.5 sm:mb-2">Episode</label>
                      <select
                        value={selectedEpisode}
                        onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                        className="w-full bg-white/10 border border-white/20 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-lg font-semibold appearance-none cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                      >
                        {Array.from(
                          { length: content.seasons.find(s => s.season_number === selectedSeason)?.episode_count || 1 },
                          (_, i) => i + 1
                        ).map((ep) => (
                          <option key={ep} value={ep} className="bg-gray-900 text-white">
                            Episode {ep}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Current Selection Display */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-lg flex items-center justify-center">
                        <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm sm:text-base">S{selectedSeason} E{selectedEpisode}</p>
                        <p className="text-gray-400 text-xs sm:text-sm">Ready to stream</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleWatch()}
                      className="bg-red-600 hover:bg-red-500 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold transition-all hover:scale-105 flex items-center space-x-1.5 sm:space-x-2 text-sm sm:text-base"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <button 
                  onClick={() => handleWatch()}
                  className="group flex items-center space-x-3 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-all duration-300 hover:scale-105 shadow-2xl shadow-white/20"
                >
                  <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                  <span>{isTV ? `Play S${selectedSeason}E${selectedEpisode}` : 'Play Now'}</span>
                </button>

                <button 
                  onClick={handleWatchTrailer}
                  className="group flex items-center space-x-3 bg-white/15 backdrop-blur-md text-white px-6 py-4 rounded-full font-semibold hover:bg-white/25 transition-all duration-300 hover:scale-105 border border-white/20"
                >
                  <Play className="w-5 h-5" />
                  <span>Trailer</span>
                </button>
                
                <button 
                  onClick={handleAddToList}
                  disabled={isOperating(movieId)}
                  className={`group p-4 rounded-full transition-all duration-300 hover:scale-110 border ${
                    isInList(movieId) 
                      ? 'bg-red-500 border-red-500 text-white' 
                      : 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20'
                  } ${isOperating(movieId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isInList(movieId) ? 'Remove from List' : 'Add to List'}
                >
                  <Heart className={`w-6 h-6 ${isInList(movieId) ? 'fill-current' : ''}`} />
                </button>
              </div>
           </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
              <div className="w-1 h-3 bg-white/50 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Seasons & Episodes Section for TV Shows */}
        {isTV && content.seasons && content.seasons.length > 0 && (
          <div className="w-full px-4 md:px-16 py-12 md:py-20 bg-gradient-to-b from-gray-900 to-black">
            <div className="max-w-7xl mx-auto">
              {/* Season Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white">Episodes</h2>
                
                {/* Season Dropdown */}
                <div className="relative z-30">
                  <button
                    onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                    className="flex items-center space-x-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/10 transition-all min-w-[200px] justify-between"
                  >
                    <span className="text-white font-medium">
                      Season {selectedSeason}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showSeasonDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showSeasonDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSeasonDropdown(false)} />
                      <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/98 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-64 overflow-y-auto">
                        {content.seasons
                          .filter(season => season.season_number > 0)
                          .map((season) => (
                            <button
                              key={season.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSeason(season.season_number);
                                setSelectedEpisode(1);
                                setShowSeasonDropdown(false);
                              }}
                              className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-all ${
                                selectedSeason === season.season_number 
                                  ? 'bg-red-600 text-white' 
                                  : 'text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              <span className="font-medium">{season.name}</span>
                              <span className="text-sm opacity-70">({season.episode_count} eps)</span>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Episodes Grid */}
              {(() => {
                const currentSeason = content.seasons.find(s => s.season_number === selectedSeason);
                const episodeCount = currentSeason?.episode_count || 10;
                
                return (
                  <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-3">
                    {Array.from({ length: episodeCount }, (_, i) => i + 1).map((episodeNum) => (
                      <button
                        key={episodeNum}
                        onClick={() => setSelectedEpisode(episodeNum)}
                        onDoubleClick={() => handleWatch(episodeNum)}
                        className={`group relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl border transition-all duration-200 hover:scale-105 ${
                          selectedEpisode === episodeNum
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <PlayCircle className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1 ${selectedEpisode === episodeNum ? 'text-white' : 'text-red-500 group-hover:text-red-400'}`} />
                        <span className="font-bold text-xs sm:text-sm">{episodeNum}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Play Selected Episode */}
              <div className="mt-6 sm:mt-8 p-3 sm:p-5 bg-gradient-to-r from-red-600/10 to-transparent rounded-xl sm:rounded-2xl border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Ready to play</p>
                  <p className="text-white text-base sm:text-xl font-bold">Season {selectedSeason}, Episode {selectedEpisode}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">Tap an episode above to change selection</p>
                </div>
                <button
                  onClick={() => handleWatch()}
                  className="flex items-center space-x-2 sm:space-x-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-5 sm:px-8 py-2.5 sm:py-4 rounded-full font-bold text-sm sm:text-lg transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/30"
                >
                  <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-current" />
                  <span>Play S{selectedSeason}E{selectedEpisode}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trailer Section */}
        {trailer && (
          <div className="w-full px-4 md:px-16 py-12 md:py-20 bg-gray-900">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 md:mb-12 text-center">Official Trailer</h2>
            <div className="aspect-video max-w-6xl mx-auto">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Content Trailer"
                className="w-full h-full rounded-lg"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}

        {/* Additional Details */}
        <div className="w-full px-4 sm:px-6 md:px-16 py-12 md:py-20 bg-black">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6 sm:mb-8 md:mb-12">About {contentTitle}</h2>
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
              <div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-white mb-3 sm:mb-4 md:mb-6">Details</h3>
                <div className="space-y-2 sm:space-y-3 md:space-y-4 text-sm sm:text-base md:text-lg text-gray-300">
                  {releaseDate && (
                    <p>
                      <span className="text-white font-semibold">
                        {isTV ? 'First Air Date:' : 'Release Date:'}
                      </span> {new Date(releaseDate).toLocaleDateString()}
                    </p>
                  )}
                  <p><span className="text-white font-semibold">Rating:</span> {content.vote_average.toFixed(1)}/10</p>
                  {content.runtime && <p><span className="text-white font-semibold">Runtime:</span> {content.runtime} minutes</p>}
                  {isTV && content.number_of_seasons && (
                    <p><span className="text-white font-semibold">Seasons:</span> {content.number_of_seasons}</p>
                  )}
                  {content.genres && (
                    <p><span className="text-white font-semibold">Genres:</span> {content.genres.map(g => g.name).join(', ')}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-white mb-3 sm:mb-4 md:mb-6">Synopsis</h3>
                <p className="text-sm sm:text-base md:text-lg text-gray-300 leading-relaxed">{content.overview}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Rating Section */}
        <div className="w-full px-4 sm:px-6 md:px-16 py-8 bg-gradient-to-b from-black to-gray-900/50">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Rate this {isTV ? 'Series' : 'Movie'}</h3>
              <QuickRating 
                contentId={content.id} 
                contentType={isTV ? 'tv' : 'movie'} 
                size="lg"
              />
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <ReviewSection
          contentId={content.id}
          contentType={isTV ? 'tv' : 'movie'}
          contentTitle={contentTitle}
          contentPosterPath={content.poster_path}
        />

        {/* Comments Section */}
        <CommentSection
          contentId={content.id}
          contentType={isTV ? 'tv' : 'movie'}
        />
      </div>

      {/* Video Player - rendered in portal so it escapes PageTransition's transform and displays full viewport */}
      {showPlayer && content && createPortal(
        (() => {
          const watchProgress = getProgress(content.id, isTV ? selectedSeason : undefined, isTV ? selectedEpisode : undefined);
          // Prefer URL resume position (from Continue Watching) when provided; fall back to Firestore progress
          const effectiveResumePosition = resumePosition ?? watchProgress?.progress_seconds;
          // Prefer stored total duration when available (from watch history), else derive from content
          let totalDuration: number | undefined;
          if (watchProgress?.total_duration_seconds && watchProgress.total_duration_seconds > 0) {
            totalDuration = watchProgress.total_duration_seconds;
          } else if (isTV) {
            totalDuration = content.runtime ? content.runtime * 60 : 45 * 60;
          } else {
            totalDuration = content.runtime ? content.runtime * 60 : undefined;
          }
          
          return (
            <div
              key={`player-${content.id}-${isTV ? `s${selectedSeason}e${selectedEpisode}` : ''}`}
              className="fixed inset-0 z-[9999]"
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                backgroundColor: '#000',
              }}
            >
              <VideoPlayer 
                movieId={content.id} 
                title={contentTitle}
                description={content.overview}
                onClose={handleClosePlayer}
                mediaType={isTV ? "tv" : "movie"}
                season={isTV ? selectedSeason : undefined}
                episode={isTV ? selectedEpisode : undefined}
                posterPath={content.poster_path}
                resumePosition={effectiveResumePosition}
                totalDuration={totalDuration}
              />
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};

export default MovieDetails;
