import { useState, useEffect, useRef, useCallback } from "react";
import { X, Server, ArrowLeft, Maximize2, Minimize2, MonitorPlay, Tv, Film, RefreshCw, AlertTriangle } from "lucide-react";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useToast } from "@/hooks/use-toast";

interface VideoPlayerProps {
  movieId: number;
  title: string;
  description?: string;
  onClose: () => void;
  isTrailer?: boolean;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  posterPath?: string;
  resumePosition?: number; // Resume position in seconds
  totalDuration?: number; // Total duration in seconds
}

const VideoPlayer = ({ movieId, title, description, onClose, isTrailer = false, mediaType = "movie", season, episode, posterPath, resumePosition, totalDuration }: VideoPlayerProps) => {
  const [currentServer, setCurrentServer] = useState(0);
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { updateProgress } = useWatchHistory();
  const { toast } = useToast();

  // Build streaming sources with proper TMDB ID format
  const streamingSources = [
    { 
      name: "VidSrc Pro", 
      icon: "🎬",
      url: mediaType === "tv" && season && episode 
        ? `https://vidsrc.xyz/embed/tv?tmdb=${movieId}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${movieId}` 
    },
    { 
      name: "VidLink", 
      icon: "🔗",
      url: mediaType === "tv" && season && episode 
        ? `https://vidlink.pro/tv/${movieId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${movieId}` 
    },
    { 
      name: "VidSrc ICU", 
      icon: "🎥",
      url: mediaType === "tv" && season && episode 
        ? `https://vidsrc.icu/embed/tv/${movieId}/${season}/${episode}`
        : `https://vidsrc.icu/embed/movie/${movieId}` 
    },
    { 
      name: "VidSrc CC", 
      icon: "📺",
      url: mediaType === "tv" && season && episode
        ? `https://vidsrc.cc/v2/embed/tv/${movieId}/${season}/${episode}`
        : `https://vidsrc.cc/v2/embed/movie/${movieId}` 
    },
    { 
      name: "Embed SU", 
      icon: "🎞️",
      url: mediaType === "tv" && season && episode
        ? `https://embed.su/embed/tv/${movieId}/${season}/${episode}`
        : `https://embed.su/embed/movie/${movieId}` 
    },
    { 
      name: "SuperEmbed", 
      icon: "📽️",
      url: mediaType === "tv" && season && episode
        ? `https://multiembed.mov/?video_id=${movieId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${movieId}&tmdb=1` 
    },
    { 
      name: "AutoEmbed", 
      icon: "⚡",
      url: mediaType === "tv" && season && episode
        ? `https://player.autoembed.cc/embed/tv/${movieId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${movieId}` 
    },
    { 
      name: "SmashyStream", 
      icon: "💥",
      url: mediaType === "tv" && season && episode
        ? `https://player.smashy.stream/tv/${movieId}?s=${season}&e=${episode}`
        : `https://player.smashy.stream/movie/${movieId}` 
    },
  ];

  const currentSource = streamingSources[currentServer];

  const handleClose = useCallback(async () => {
    // Save progress before closing
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    if (startTimeRef.current && totalDuration && !isTrailer) {
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const finalProgress = (resumePosition || 0) + elapsedSeconds;
      
      if (finalProgress < totalDuration) {
        try {
          await updateProgress(
            movieId,
            mediaType,
            title,
            posterPath || null,
            finalProgress,
            totalDuration,
            season,
            episode
          );
        } catch (error) {
          console.error('Error saving final watch progress:', error);
        }
      }
    }
    
    onClose();
  }, [movieId, mediaType, title, posterPath, season, episode, totalDuration, resumePosition, isTrailer, updateProgress, onClose]);

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    // Clear progress tracking when switching servers
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    startTimeRef.current = null;
    // Try next server
    setCurrentServer((prev) => (prev + 1) % streamingSources.length);
  };

  // Handle keyboard shortcuts (must be after handleClose is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (e.key === 't' || e.key === 'T') setIsTheaterMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Reset loading state when server changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [currentServer]);

  // Lock body scroll when player is open, restore on unmount
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Cleanup progress tracking on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black z-50 overflow-hidden"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 50,
        opacity: 1,
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,0,0,0.1),transparent_70%)]" />
      </div>

      {/* Main Container */}
      <div className="relative h-full flex flex-col overflow-hidden">
        {/* Top Bar - Responsive */}
        <div className={`flex-shrink-0 bg-gradient-to-b from-black via-black/80 to-transparent transition-all duration-300 ${isTheaterMode ? 'opacity-0 hover:opacity-100' : ''}`}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left: Back & Title */}
              <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
                <button
                  onClick={handleClose}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-300 group backdrop-blur-sm border border-white/5"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:-translate-x-1 transition-transform" />
                  <span className="text-white text-xs sm:text-sm font-medium hidden xs:inline">Back</span>
                </button>
                
                <div className="min-w-0 flex-1 hidden sm:block">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                      {mediaType === "tv" ? <Tv className="w-4 h-4 text-white" /> : <Film className="w-4 h-4 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-base lg:text-lg font-bold text-white truncate">{title}</h1>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        {isTrailer && <span className="text-red-400">Trailer</span>}
                        {mediaType === "tv" && season && episode && (
                          <span>Season {season}, Episode {episode}</span>
                        )}
                        {!isTrailer && !season && <span>Full {mediaType === "tv" ? "Episode" : "Movie"}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right: Controls */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                {/* Server Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowServerSelector(!showServerSelector)}
                    className="flex items-center space-x-1 sm:space-x-2 bg-white/10 hover:bg-white/20 text-white h-8 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl transition-all duration-300 border border-white/5 backdrop-blur-sm"
                  >
                    <Server className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                    <span className="text-xs sm:text-sm font-medium hidden md:inline">{currentSource.name}</span>
                    <span className="text-base sm:text-lg">{currentSource.icon}</span>
                  </button>
                  
                  {showServerSelector && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowServerSelector(false)} />
                      <div className="absolute top-full right-0 mt-2 w-56 sm:w-72 max-h-[70vh] overflow-y-auto bg-gray-900/98 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl z-20 shadow-2xl shadow-black/50 animate-scale-in">
                        <div className="p-2 sm:p-3 bg-gradient-to-r from-red-500/10 to-transparent border-b border-white/5 sticky top-0 bg-gray-900/98">
                          <div className="flex items-center space-x-2">
                            <MonitorPlay className="w-4 h-4 text-red-400" />
                            <span className="text-xs sm:text-sm font-semibold text-white">Select Server</span>
                          </div>
                        </div>
                        <div className="p-1 sm:p-2">
                          {streamingSources.map((source, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setCurrentServer(index);
                                setShowServerSelector(false);
                              }}
                              className={`w-full flex items-center space-x-2 sm:space-x-3 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all ${
                                currentServer === index 
                                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20' 
                                  : 'text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              <span className="text-lg sm:text-xl">{source.icon}</span>
                              <span className="font-medium flex-1 text-left">{source.name}</span>
                              {currentServer === index && (
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="p-2 sm:p-3 bg-black/30 border-t border-white/5 sticky bottom-0">
                          <p className="text-[10px] sm:text-xs text-gray-500 text-center">Switch server if video doesn't load</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Theater Mode Toggle */}
                <button
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-300 border border-white/5 backdrop-blur-sm"
                  title={isTheaterMode ? "Exit Theater Mode (T)" : "Theater Mode (T)"}
                >
                  {isTheaterMode ? (
                    <Minimize2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  ) : (
                    <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  )}
                </button>

                {/* Close */}
                <button
                  onClick={handleClose}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-white/10 hover:bg-red-500 rounded-lg sm:rounded-xl transition-all duration-300 border border-white/5 backdrop-blur-sm group"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Container - min-h-0 allows flex child to size correctly */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="relative w-full max-w-6xl">
            {/* Video Wrapper */}
            <div 
              className="relative w-full bg-black overflow-hidden rounded-xl shadow-2xl shadow-black/80 border border-white/10"
              style={{ aspectRatio: '16/9' }}
            >
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10">
                  <div className="relative mb-4 sm:mb-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                    <Film className="w-4 h-4 sm:w-6 sm:h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-white font-medium mb-1 text-sm sm:text-base">Loading {currentSource.name}...</p>
                  <p className="text-gray-500 text-xs sm:text-sm">Preparing your stream</p>
                </div>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10 p-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                  </div>
                  <p className="text-white font-medium mb-2 text-sm sm:text-base">Playback Error</p>
                  <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 text-center">This server might be unavailable</p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-medium hover:scale-105 transition-all"
                  >
                    <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Try Next Server</span>
                  </button>
                </div>
              )}

              {/* Video Frame */}
              <iframe
                key={currentServer}
                src={currentSource.url}
                title={`Watch ${title}`}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => {
                  setIsLoading(false);
                  // Start tracking progress when iframe loads
                  if (!isTrailer && totalDuration) {
                    startTimeRef.current = Date.now();
                    
                    // Show resume notification if resuming
                    if (resumePosition && resumePosition > 60) {
                      const minutes = Math.floor(resumePosition / 60);
                      toast({
                        title: "Resuming playback",
                        description: `Continuing from ${minutes} minute${minutes > 1 ? 's' : ''} in`,
                      });
                    }

                    // Update progress every 30 seconds
                    if (progressIntervalRef.current) {
                      clearInterval(progressIntervalRef.current);
                    }
                    progressIntervalRef.current = setInterval(async () => {
                      if (startTimeRef.current) {
                        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                        const currentProgress = (resumePosition || 0) + elapsedSeconds;
                        
                        // Only update if we have valid data
                        if (currentProgress < totalDuration) {
                          try {
                            await updateProgress(
                              movieId,
                              mediaType,
                              title,
                              posterPath || null,
                              currentProgress,
                              totalDuration,
                              season,
                              episode
                            );
                          } catch (error) {
                            console.error('Error updating watch progress:', error);
                          }
                        }
                      }
                    }, 30000); // Update every 30 seconds
                  }
                }}
                onError={() => setHasError(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;