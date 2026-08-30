"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from "next-intl";
import { Play, Star, X, Heart, Calendar, Clock, Users, ArrowLeft, Tv, Film, ChevronDown, PlayCircle, Loader2, Share2, Download } from "lucide-react";
import { getImageUrl, getBackdropUrl, TMDBMovie, TMDBSeason, isNotReleasedYet } from "@/utils/tmdbApi";
import { useContentDetails } from "@/hooks/queries/useContentDetails";
import { useRelatedContent } from "@/hooks/queries/useRelatedContent";
import { useToast } from "@/hooks/use-toast";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { enqueueDownload } from "@/lib/offline/downloadManager";
import { trackDownload } from "@/lib/analytics";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { SpoilerProtectedEpisode } from "./spoiler/SpoilerProtectedEpisode";
import { BreadcrumbNav } from "./BreadcrumbNav";
import { CastCrewGrid } from "./CastCrewGrid";
import { TrendingDiscussions } from "./TrendingDiscussions";
import QuickRating from "./QuickRating";
import MovieCard from "./MovieCard";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { stripPartyQueryParams } from "@/lib/player/partyUrl";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";
import { PlayerErrorFallback } from "./player/PlayerErrorFallback";

const VideoPlayer = dynamic(() => import("./VideoPlayer"), { ssr: false });
const ReviewSection = dynamic(() => import("./ReviewSection"), { ssr: false });
const CommentSection = dynamic(() => import("./CommentSection"), { ssr: false });

interface MovieDetailsProps {
  movieId: number;
  mediaType?: "movie" | "tv";
  onClose: () => void;
  autoplay?: boolean;
  resumePosition?: number;
  initialSeason?: number;
  initialEpisode?: number;
  initialServer?: number;
}

const MovieDetails = ({ movieId, mediaType, onClose, autoplay = false, resumePosition, initialSeason, initialEpisode, initialServer }: MovieDetailsProps) => {
  const t = useTranslations("details");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestJoinMode = searchParams.get("guest") === "1";
  const { data: content = null, isLoading: loading, isError } = useContentDetails(movieId, mediaType);
  const error = isError ? t("loadError") : null;
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerSession, setPlayerSession] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason || 1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode || 1);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const { data: relatedContent = [] } = useRelatedContent(content, mediaType);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { hasPremium } = useSubscription();
  const { addToList, removeFromList, isInList, isOperating, loading: loadingList } = useUserMovieListContext();
  const pathname = usePathname();
  const { getProgress } = useWatchHistoryContext();
  const userClosedPlayerRef = useRef(false);

  useEffect(() => {
    userClosedPlayerRef.current = false;
  }, [movieId, initialSeason, initialEpisode]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 64) setShowScrollHint(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!showSeasonDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSeasonDropdown(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSeasonDropdown]);

  const openPlayer = () => {
    userClosedPlayerRef.current = false;
    setPlayerSession((k) => k + 1);
    setShowPlayer(true);
  };

  // Handle autoplay (skip for unreleased content - cannot play)
  useEffect(() => {
    if (userClosedPlayerRef.current) return;
    if (autoplay && content && !showPlayer && !isNotReleasedYet(content)) {
      const delay = guestJoinMode ? 0 : 500;
      const timer = setTimeout(() => {
        openPlayer();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [autoplay, content, showPlayer, guestJoinMode]);

  useBodyScrollLock(showPlayer);

  const handleClose = () => {
    onClose();
  };

  // Closing the player (X / Esc) must not reopen it — strip party/autoplay from URL.
  const handleClosePlayer = () => {
    userClosedPlayerRef.current = true;
    setShowPlayer(false);
    const currentParams = stripPartyQueryParams(new URLSearchParams(searchParams.toString()));
    currentParams.delete("resume");
    const newQs = currentParams.toString();
    router.replace(`${pathname}${newQs ? `?${newQs}` : ""}`);
  };

  const handleAddToList = async () => {
    if (!content) return;

    const contentTitle = content?.title || content?.name || 'Unknown';

    if (!isAuthenticated) {
      toast({
        title: t("signInRequired"),
        description: t("signInForList"),
        variant: "destructive",
      });
      return;
    }

    const isCurrentlyInList = isInList(movieId);

    try {
      if (isCurrentlyInList) {
        await removeFromList(movieId);
        toast({
          title: t("removedFromList"),
          description: contentTitle,
        });
      } else {
        const movieData: TMDBMovie = {
          ...content,
          id: movieId,
          media_type: mediaType || (content.first_air_date ? 'tv' : 'movie'),
        };
        await addToList(movieData);
        toast({
          title: t("addedToList"),
          description: contentTitle,
        });
      }
    } catch (error: unknown) {
      toast({
        title: t("listError"),
        description: error instanceof Error ? error.message : t("listError"),
        variant: "destructive",
      });
    }
  };

  const handleWatch = (episode?: number) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: t("signInRequired"),
        description: t("signInToWatch"),
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
      setSelectedEpisode(episodeToPlay);
    }

    openPlayer();
    toast({
      title: t("nowPlaying"),
      description: isTVShow
        ? t("playingEpisode", { season: selectedSeason, episode: episodeToPlay })
        : t("playingTitle", { title: contentTitle }),
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
        title: t("trailerPlaying"),
        description: t("openingTrailer", { title: contentTitle }),
      });
    } else {
      toast({
        title: t("noTrailer"),
        description: t("noTrailerDesc", { title: contentTitle }),
        variant: "destructive"
      });
    }
  };

  const handleShare = async () => {
    const contentTitle = content?.title || content?.name || 'Unknown';
    const url = `${window.location.origin}/movie/${movieId}?type=${mediaType || (content?.first_air_date ? 'tv' : 'movie')}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: contentTitle, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t("linkCopied"), description: t("linkCopiedDesc", { title: contentTitle }) });
    }
  };

  const handleDownload = async () => {
    if (!content) return;
    if (!hasPremium) {
      toast({
        title: t("premiumRequired"),
        description: t("premiumDownload"),
        variant: "destructive",
      });
      return;
    }

    const contentTitle = content.title || content.name || "Unknown";
    const isTvContent = content.media_type === "tv" || mediaType === "tv";
    const trailer = content.videos?.results.find(
      (v) => v.type === "Trailer" && v.site === "YouTube"
    );

    try {
      await enqueueDownload({
        tmdbId: content.id,
        mediaType: isTvContent ? "tv" : "movie",
        title: contentTitle,
        posterPath: content.poster_path,
        season: isTvContent ? selectedSeason : undefined,
        episode: isTvContent ? selectedEpisode : undefined,
        trailerKey: trailer?.key,
      });
      trackDownload(content.id, isTvContent ? "tv" : "movie");
      toast({
        title: t("downloadStarted"),
        description: contentTitle,
      });
    } catch {
      toast({
        title: t("downloadFailed"),
        description: t("downloadFailedDesc"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black z-[9999] flex items-center justify-center transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400">{t("loading")}</p>
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
          <h2 className="text-white text-xl font-bold mb-2">{error || t("loadError")}</h2>
          <p className="text-gray-400 mb-6">{t("loadError")}</p>
          <button
            onClick={handleClose}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
          >
            {t("back")}
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
  const isUnreleased = isNotReleasedYet(content);

  return (
    <div
      className={`min-h-screen w-full bg-black transition-all duration-500 ease-out overflow-x-clip ${isVisible ? 'opacity-100' : 'opacity-0'
        }`}
    >
      <div className="relative w-full overflow-visible">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleClose}
          className="fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] sm:top-6 sm:left-6 z-[999] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3.5 py-2 backdrop-blur-xl transition-all duration-200 group cursor-pointer hover:bg-white/10 hover:border-white/30 focus-ring sm:px-4"
        >
          <ArrowLeft className="w-4 h-4 sm:w-4 sm:h-4 text-white group-hover:-translate-x-1 transition-transform" />
          <span className="text-white text-xs sm:text-sm font-semibold">{t("back")}</span>
        </button>

        {/* Hero Section */}
        <div className="relative min-h-screen w-full flex flex-col">
          {/* Background with Ken Burns effect */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none hero-ken-burns-alt"
            style={{ backgroundImage: `url(${getBackdropUrl(content.backdrop_path)})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent"></div>
          </div>

          {/* Content */}
          <div className={`relative z-10 flex flex-col justify-center min-h-screen w-full px-4 sm:px-6 md:px-12 lg:px-20 py-20 sm:py-24 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
            <div className="max-w-4xl w-full">
              {/* Content Type Badge */}
              <div className="flex items-center gap-2 mb-4 sm:mb-6 flex-wrap">
                <span className="badge-pill badge-hd">
                  {isTV ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                  <span>{isTV ? "Series" : "Film"}</span>
                </span>
                {content.vote_average > 7.5 && !isUnreleased && (
                  <span className="badge-pill badge-top">⭐ Top Rated</span>
                )}
                {isUnreleased && (
                  <span className="badge-pill bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {t("comingSoon")}
                  </span>
                )}
                {(content as { adult?: boolean }).adult && (
                  <span className="badge-pill !bg-white/10 !border-white/20 text-white">18+</span>
                )}
              </div>

              {/* Title */}
              <h1 className="hero-text-shadow-strong mb-3 text-white text-balance font-black tracking-tight sm:mb-4 text-3xl sm:text-4xl md:text-6xl lg:text-7xl" style={{ lineHeight: "1.05" }}>
                {contentTitle}
              </h1>

              {/* Tagline */}
              {content.tagline && (
                <p className="hero-text-shadow mb-6 text-base font-light italic text-gray-300 md:text-xl">{content.tagline}</p>
              )}

              {/* Meta Info */}
              <div className="mb-6 flex flex-wrap items-center gap-2.5">
                {content.vote_average > 0 && (
                  <span className={`badge-pill ${content.vote_average >= 7 ? "badge-rating-green" : content.vote_average >= 5.5 ? "badge-rating-amber" : "badge-rating-red"}`}>
                    <Star className="h-3 w-3 fill-current" />
                    <span>{content.vote_average.toFixed(1)}</span>
                  </span>
                )}
                {releaseDate && (
                  <span className="meta-pill">
                    <Calendar className="h-3 w-3" />
                    <span>{isUnreleased ? `Releases ${new Date(releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : new Date(releaseDate).getFullYear()}</span>
                  </span>
                )}
                {content.runtime && (
                  <span className="meta-pill">
                    <Clock className="h-3 w-3" />
                    <span>{Math.floor(content.runtime / 60)}h {content.runtime % 60}m</span>
                  </span>
                )}
                {isTV && content.number_of_seasons && (
                  <span className="meta-pill">
                    <Users className="h-3 w-3" />
                    <span>
                      {content.number_of_seasons > 1
                        ? t("seasonsPlural", { count: content.number_of_seasons })
                        : t("seasons", { count: content.number_of_seasons })}
                    </span>
                  </span>
                )}
                <span className="inline-flex items-center rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white">HD</span>
              </div>

              {/* Genres */}
              {content.genres && content.genres.length > 0 && (
                <div className="mb-8 flex flex-wrap gap-2">
                  {content.genres.map((genre) => (
                    <span key={genre.id} className="meta-pill border-red-500/30 bg-red-500/10 text-red-300">
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              <p className="hero-text-shadow text-sm sm:text-base md:text-lg text-gray-200/90 mb-6 sm:mb-10 max-w-3xl leading-relaxed">
                {content.overview}
              </p>

              {/* TV Show Season/Episode Selector - In Hero (only for released content) */}
              {isTV && !isUnreleased && content.seasons && content.seasons.length > 0 && (
                <div className="mb-6 sm:mb-8 w-full max-w-2xl rounded-xl bg-black/50 backdrop-blur-md p-3 sm:p-5 ring-1 ring-white/10">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-gray-400 text-xs mb-1.5 font-semibold uppercase tracking-wider">{t("season")}</label>
                      <select
                        value={selectedSeason}
                        onChange={(e) => {
                          setSelectedSeason(Number(e.target.value));
                          setSelectedEpisode(1);
                        }}
                        className="w-full bg-white/5 border border-white/15 text-white rounded-md px-3 py-2.5 text-sm font-semibold appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                      >
                        {content.seasons
                          .filter(season => season.season_number > 0)
                          .map((season) => (
                            <option key={season.id} value={season.season_number} className="bg-gray-900 text-white">
                              {t("season")} {season.season_number} ({season.episode_count} eps)
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="block text-gray-400 text-xs mb-1.5 font-semibold uppercase tracking-wider">{t("episode")}</label>
                      <select
                        value={selectedEpisode}
                        onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/15 text-white rounded-md px-3 py-2.5 text-sm font-semibold appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                      >
                        {Array.from(
                          { length: content.seasons.find(s => s.season_number === selectedSeason)?.episode_count || 1 },
                          (_, i) => i + 1
                        ).map((ep) => (
                          <option key={ep} value={ep} className="bg-gray-900 text-white">
                            {t("episode")} {ep}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-red-600 flex items-center justify-center">
                        <Tv className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">S{selectedSeason} E{selectedEpisode}</p>
                        <p className="text-gray-400 text-xs">{t("readyToStream")}</p>
                      </div>
                    </div>
                    {!isUnreleased && (
                      <button
                        onClick={() => handleWatch()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-bold text-black transition-colors hover:bg-white/85 focus-ring"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{tc("play")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {!isUnreleased && (
                  <button
                    onClick={() => handleWatch()}
                    className="cta-primary !rounded-md !px-6 !py-2.5 sm:!px-8 sm:!py-3.5 !text-sm sm:!text-base"
                    aria-label="Play"
                  >
                    <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
                    <span>{isTV ? `${tc("play")} S${selectedSeason}E${selectedEpisode}` : tc("play")}</span>
                  </button>
                )}

                {trailer && (
                  <button
                    onClick={handleWatchTrailer}
                    className="cta-secondary !rounded-md !px-5 !py-2.5 sm:!px-6 sm:!py-3.5 !text-sm sm:!text-base"
                  >
                    <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{t("trailer")}</span>
                  </button>
                )}

                <button
                  onClick={handleAddToList}
                  disabled={isOperating(movieId) || loadingList}
                  className={`cta-icon !rounded-full ${isInList(movieId) ? '!bg-red-500/30 !border-red-500' : ''} ${(isOperating(movieId) || loadingList) ? 'cursor-not-allowed opacity-50' : ''}`}
                  title={isInList(movieId) ? tc("removeFromList") : tc("addToList")}
                  aria-label={isInList(movieId) ? tc("removeFromList") : tc("addToList")}
                >
                  {isOperating(movieId) ? (
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                  ) : (
                    <Heart className={`h-5 w-5 sm:h-6 sm:w-6 ${isInList(movieId) ? 'fill-current' : ''}`} />
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="cta-icon !rounded-full"
                  title={hasPremium ? tc("download") : t("premiumRequired")}
                  aria-label={tc("download")}
                >
                  <Download className={`h-5 w-5 sm:h-6 sm:w-6 ${!hasPremium ? "opacity-60" : ""}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="cta-icon !rounded-full"
                  title={tc("share")}
                  aria-label={tc("share")}
                >
                  <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>
          </div>

          {showScrollHint && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hero-scroll-indicator pointer-events-none transition-opacity duration-500">
              <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
                <div className="w-1 h-3 bg-white/50 rounded-full" />
              </div>
            </div>
          )}
        </div>

        {/* Breadcrumb navigation */}
        <div className="w-full px-4 md:px-16 py-3 bg-black/50 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <BreadcrumbNav
              items={[
                {
                  label: isTV ? tn("tvShows") : tn("movies"),
                  href: isTV ? "/tv-shows" : "/movies",
                },
                { label: contentTitle },
              ]}
            />
          </div>
        </div>

        {/* Seasons & Episodes Section for TV Shows (only for released content) */}
        {isTV && !isUnreleased && content.seasons && content.seasons.length > 0 && (
          <div className="w-full px-4 md:px-16 py-12 md:py-20">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 overflow-visible">
                <SectionHeader title={t("episodes")} eyebrow={`${content.number_of_seasons || 0} ${content.number_of_seasons === 1 ? "season" : "seasons"}`} />

                <div className="relative z-30">
                  <button
                    onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-md ring-1 ring-white/10 transition-colors min-w-[200px] justify-between focus-ring"
                  >
                    <span className="text-white text-sm font-semibold">
                      {t("season")} {selectedSeason}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSeasonDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showSeasonDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSeasonDropdown(false)} />
                      <div className="absolute top-full right-0 mt-2 w-[280px] bg-[#0a0a0c]/98 backdrop-blur-xl border border-white/10 rounded-md overflow-hidden z-50 shadow-2xl max-h-64 overflow-y-auto">
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
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${selectedSeason === season.season_number
                                ? 'bg-white text-black font-semibold'
                                : 'text-gray-300 hover:bg-white/5'
                                }`}
                            >
                              <span className="font-medium">{season.name}</span>
                              <span className="text-xs opacity-70">({season.episode_count} eps)</span>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(() => {
                const currentSeason = content.seasons.find(s => s.season_number === selectedSeason);
                const episodeCount = currentSeason?.episode_count || 10;

                return (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                    {Array.from({ length: episodeCount }, (_, i) => i + 1).map((episodeNum) => (
                      <SpoilerProtectedEpisode
                        key={`spoiler-${episodeNum}`}
                        contentId={content.id}
                        season={selectedSeason}
                        episode={episodeNum}
                        className="w-full h-full"
                      >
                        <button
                          key={episodeNum}
                          type="button"
                          onClick={() => {
                            if (selectedEpisode === episodeNum) {
                              handleWatch(episodeNum);
                            } else {
                              setSelectedEpisode(episodeNum);
                            }
                          }}
                          className={`w-full h-full group relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-md ring-1 transition-all duration-200 hover:scale-105 min-h-[68px] ${selectedEpisode === episodeNum
                            ? 'bg-white text-black ring-white shadow-lg'
                            : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10 hover:ring-white/20'
                            }`}
                          aria-label={`${t("episode")} ${episodeNum}${selectedEpisode === episodeNum ? `, ${t("tapToSelect")}` : ''}`}
                        >
                          <PlayCircle className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1 ${selectedEpisode === episodeNum ? 'text-black' : 'text-red-500 group-hover:text-red-400'}`} />
                          <span className="font-bold text-xs sm:text-sm">E{episodeNum}</span>
                        </button>
                      </SpoilerProtectedEpisode>
                    ))}
                  </div>
                );
              })()}

              <div className="mt-6 sm:mt-8 p-4 sm:p-5 rounded-xl bg-white/5 ring-1 ring-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-gray-400 text-xs mb-0.5">{t("readyToPlay")}</p>
                  <p className="text-white text-base sm:text-lg font-bold">{t("seasonEpisode", { season: selectedSeason, episode: selectedEpisode })}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{t("tapToSelect")}</p>
                </div>
                <button
                  onClick={() => handleWatch()}
                  className="cta-primary !rounded-md !px-5 !py-2.5 sm:!px-6 sm:!py-3 !text-sm sm:!text-base"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  <span>{tc("play")} S{selectedSeason}E{selectedEpisode}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trailer Section */}
        {trailer && (
          <div className="w-full px-4 md:px-16 py-12 md:py-20">
            <div className="max-w-6xl mx-auto">
              <SectionHeader title={t("trailer")} eyebrow="Official" />
              <div className="mt-6 aspect-video overflow-hidden rounded-xl ring-1 ring-white/10">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  title={t("trailer")}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {/* Detail tabs */}
        <Tabs defaultValue="overview" className="content-auto w-full px-4 py-12 sm:px-6 md:px-16 md:py-16">
          <div className="max-w-7xl mx-auto">
            <TabsList className="mb-8 inline-flex flex-wrap gap-1 glass-soft rounded-lg p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-md px-4 py-2 text-sm font-semibold text-gray-300 transition-all">{t("overview")}</TabsTrigger>
              <TabsTrigger value="cast" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-md px-4 py-2 text-sm font-semibold text-gray-300 transition-all">{t("cast")}</TabsTrigger>
              <TabsTrigger value="similar" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-md px-4 py-2 text-sm font-semibold text-gray-300 transition-all">{t("similar")}</TabsTrigger>
              <TabsTrigger value="reviews" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-md px-4 py-2 text-sm font-semibold text-gray-300 transition-all">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Reveal>
                <section className="glass-soft rounded-2xl p-6 sm:p-8">
                  <SectionHeader title={t("overview")} eyebrow={contentTitle} />
                  <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
                    <div className="space-y-2.5 text-sm text-gray-300 sm:text-base">
                      {releaseDate && (
                        <p><span className="font-semibold text-white">{isTV ? 'First Air Date:' : 'Release Date:'}</span> {new Date(releaseDate).toLocaleDateString()}</p>
                      )}
                      <p><span className="font-semibold text-white">{tc("rating")}:</span> {content.vote_average.toFixed(1)}/10</p>
                      {content.runtime && <p><span className="font-semibold text-white">Runtime:</span> {content.runtime} minutes</p>}
                      {isTV && content.number_of_seasons && (
                        <p><span className="font-semibold text-white">{t("season")}:</span> {content.number_of_seasons}</p>
                      )}
                      {content.genres && (
                        <p><span className="font-semibold text-white">Genres:</span> {content.genres.map(g => g.name).join(', ')}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm leading-relaxed text-gray-300 sm:text-base lg:text-lg">{content.overview}</p>
                    </div>
                  </div>
                </section>
              </Reveal>
              <Reveal className="mt-6">
                <div className="glass-soft rounded-2xl p-6">
                  <h3 className="mb-4 text-lg font-semibold text-white">{isTV ? tc("series") : tc("movie")}</h3>
                  <QuickRating
                    contentId={content.id}
                    contentType={isTV ? 'tv' : 'movie'}
                    size="lg"
                  />
                </div>
              </Reveal>
            </TabsContent>

            <TabsContent value="cast">
              {content.credits && (content.credits.cast.length > 0 || content.credits.crew.length > 0) && (
                <Reveal>
                  <SectionHeader title={t("cast")} />
                  <div className="mt-6">
                    <CastCrewGrid
                      cast={content.credits.cast.map((c) => ({
                        id: c.id,
                        name: c.name || "Unknown",
                        character: (c as any).character || "",
                        profile_path: c.profile_path,
                        order: (c as any).order || 0,
                      }))}
                      crew={content.credits.crew.map((c) => ({
                        id: c.id,
                        name: c.name || "Unknown",
                        job: (c as any).job || "",
                        department: (c as any).department || "",
                        profile_path: c.profile_path,
                      }))}
                    />
                  </div>
                </Reveal>
              )}
            </TabsContent>

            <TabsContent value="similar">
              {relatedContent.length > 0 && (
                <Reveal>
                  <SectionHeader title={t("similar")} />
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
                    {relatedContent.map((movie, index) => (
                      <MovieCard
                        key={`related-${movie.id}-${index}`}
                        movie={movie}
                        index={index}
                      />
                    ))}
                  </div>
                </Reveal>
              )}
            </TabsContent>

            <TabsContent value="reviews">
              <Reveal>
                <ReviewSection
                  contentId={content.id}
                  contentType={isTV ? 'tv' : 'movie'}
                  contentTitle={contentTitle}
                  contentPosterPath={content.poster_path}
                />
              </Reveal>
              <Reveal className="mt-6">
                <div className="glass-soft rounded-2xl p-4">
                  <TrendingDiscussions tmdbId={content.id} />
                </div>
              </Reveal>
              <CommentSection
                contentId={content.id}
                contentType={isTV ? 'tv' : 'movie'}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Video Player - rendered in portal for full-viewport playback */}
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

          const currentSeasonData = content.seasons?.find((s) => s.season_number === selectedSeason);
          const episodeCount = currentSeasonData?.episode_count;

          return (
            <FeatureErrorBoundary
              key={`player-${playerSession}-${content.id}-${isTV ? `s${selectedSeason}e${selectedEpisode}` : ""}`}
              featureName="Video player"
              fallback={<PlayerErrorFallback onClose={handleClosePlayer} />}
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
                episodeCount={isTV ? episodeCount : undefined}
                initialServer={initialServer}
                guestJoinMode={guestJoinMode}
                onAdvanceEpisode={(nextSeason, nextEpisode) => {
                  setSelectedSeason(nextSeason);
                  setSelectedEpisode(nextEpisode);
                }}
              />
            </FeatureErrorBoundary>
          );
        })(),
        document.body
      )}
    </div>
  );
};

export default MovieDetails;
