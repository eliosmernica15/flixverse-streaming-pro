"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Heart, LogIn, Film, Tv, Search, Sparkles, ArrowRight, Check, Trash2, X, RotateCcw } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import PageContainer from "@/components/PageContainer";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { TMDBMovie, getContentTitle, getContentType } from "@/utils/tmdbApi";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useToast } from "@/hooks/use-toast";

type ListTab = "all" | "movies" | "series";

const MyList = () => {
  const { isAuthenticated } = useAuth();
  const { movieList, loading, removeFromList, addToList } = useUserMovieListContext();
  const { history: watchHistory } = useWatchHistoryContext();
  const { profile } = useUserProfileContext();
  const { toast } = useToast();
  const [tab, setTab] = useState<ListTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "az">("recent");
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const myMovies = useMemo<TMDBMovie[]>(
    () =>
      movieList.map((item) => ({
        id: item.movie_id,
        title: item.media_type === "tv" ? undefined : item.movie_title,
        name: item.media_type === "tv" ? item.movie_title : undefined,
        poster_path: item.movie_poster_path ?? "",
        backdrop_path: "",
        overview: "",
        vote_average: 0,
        genre_ids: [],
        media_type: item.media_type ?? "movie",
      })),
    [movieList]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = myMovies;
    if (tab === "movies") list = list.filter((m) => getContentType(m) === "movie");
    if (tab === "series") list = list.filter((m) => getContentType(m) === "tv");
    if (q) {
      list = list.filter((m) => getContentTitle(m).toLowerCase().includes(q));
    }
    if (sort === "az") {
      list = [...list].sort((a, b) => getContentTitle(a).localeCompare(getContentTitle(b)));
    }
    return list;
  }, [myMovies, tab, query, sort]);

  const movieCount = useMemo(
    () => myMovies.filter((m) => getContentType(m) === "movie").length,
    [myMovies]
  );
  const seriesCount = useMemo(
    () => myMovies.filter((m) => getContentType(m) === "tv").length,
    [myMovies]
  );

  const greeting = profile?.display_name?.split(" ")[0] ?? "your";
  const tabs: { id: ListTab; label: string; count: number; icon: typeof Film }[] = [
    { id: "all", label: "All", count: myMovies.length, icon: Sparkles },
    { id: "movies", label: "Movies", count: movieCount, icon: Film },
    { id: "series", label: "Series", count: seriesCount, icon: Tv },
  ];

  // Multi-select handlers
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  }, [filtered, selectedIds.size]);

  const toggleSelect = useCallback((movieId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }
      return next;
    });
  }, []);

  const handleBulkRemove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      await Promise.all(Array.from(selectedIds).map(id => removeFromList(id)));
      toast({
        title: "Removed from list",
        description: `${selectedIds.size} title${selectedIds.size === 1 ? "" : "s"} removed from your list.`,
      });
      setSelectedIds(new Set());
      setIsMultiSelect(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove some titles. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedIds, removeFromList, toast]);

  const handleImportFromHistory = useCallback(async () => {
    if (watchHistory.length === 0) {
      toast({
        title: "No watch history",
        description: "Your watch history is empty. Start watching something first!",
        variant: "destructive",
      });
      return;
    }

    // Get unique content IDs from watch history that aren't already in the list
    const existingIds = new Set(myMovies.map(m => m.id));
    const historyMovies = watchHistory
      .filter(h => !existingIds.has(h.content_id))
      .slice(0, 50); // Limit to 50 items

    if (historyMovies.length === 0) {
      toast({
        title: "Already in list",
        description: "All items from your watch history are already in your list.",
      });
      return;
    }

    try {
      // Add each movie from watch history to the list
      // Construct minimal TMDBMovie objects from watch history data
      for (const item of historyMovies) {
        const movie: TMDBMovie = {
          id: item.content_id,
          title: item.content_type === "movie" ? item.content_title : undefined,
          name: item.content_type === "tv" ? item.content_title : undefined,
          poster_path: item.content_poster_path,
          backdrop_path: "",
          overview: "",
          vote_average: 0,
          genre_ids: [],
          media_type: item.content_type,
        };
        await addToList(movie);
      }
      toast({
        title: "Imported from watch history",
        description: `${historyMovies.length} title${historyMovies.length === 1 ? "" : "s"} added to your list.`,
      });
      // Exit multi-select if active
      setIsMultiSelect(false);
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import some titles from watch history.",
        variant: "destructive",
      });
    }
  }, [watchHistory, myMovies, addToList, toast]);

  const exitMultiSelect = useCallback(() => {
    setIsMultiSelect(false);
    setSelectedIds(new Set());
  }, []);

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<LogIn className="w-10 h-10 text-red-500" />}
        title="Sign in required"
        description="Create an account or sign in to save your favorite movies and TV shows to your personal list."
        actionLabel="Sign In / Sign Up"
        actionHref="/auth"
      />
    );
  }

  return (
    <div className="relative">
      {/* Cinematic header */}
      <header className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239, 68, 68, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(168, 85, 247, 0.12) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1.5">
              My List
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
              {greeting}&apos;s watchlist
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-2">
              {loading
                ? "Loading your saved titles…"
                : myMovies.length === 0
                  ? "Your list is empty — start adding titles you want to watch."
                  : `${myMovies.length} title${myMovies.length === 1 ? "" : "s"} saved · ${
                      movieCount
                    } movie${movieCount === 1 ? "" : "s"} · ${seriesCount} series`}
            </p>
          </div>
          {!loading && myMovies.length > 0 && (
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {!isMultiSelect && (
                <button
                  type="button"
                  onClick={() => setIsMultiSelect(true)}
                  className="group inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/30"
                >
                  <Check className="h-4 w-4" />
                  Select
                </button>
              )}
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/90"
              >
                <Search className="h-4 w-4" />
                Discover more
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <PageContainer className="!pt-0">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md skeleton-shimmer" />
            ))}
          </div>
        ) : myMovies.length === 0 ? (
          <>
            <EmptyState
              icon={<Heart className="w-10 h-10 text-red-500" />}
              title="Your list is empty"
              description="Start building your personal watchlist by tapping the + on any title. Anything you save will appear here, ready whenever you are."
              actionLabel="Discover Movies"
              actionHref="/"
              // Import from watch history button shown as secondary action
              // We'll render a custom empty state with two buttons below
            />
            {/* Secondary action: Import from watch history */}
            {!loading && watchHistory.length > 0 && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleImportFromHistory}
                  className="cta-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                >
                  <RotateCcw className="h-4 w-4" />
                  Import from watch history
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Filter + search bar */}
            <div className="glass-soft rounded-lg p-2 mb-6 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tab === t.id
                        ? "bg-white text-black"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                    <span
                      className={`text-[10px] font-bold tabular-nums ${
                        tab === t.id ? "text-black/60" : "text-gray-500"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter your list…"
                  className="bg-black/40 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-white/20 w-48"
                />
              </div>
              <div className="hidden sm:inline-flex rounded-md border border-white/10 bg-black/30 p-0.5">
                {(
                  [
                    { key: "recent", label: "Recent" },
                    { key: "az", label: "A–Z" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    aria-pressed={sort === s.key}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                      sort === s.key
                        ? "bg-white text-black"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-select bar */}
            {isMultiSelect && (
              <div className="glass-panel border border-white/10 rounded-lg p-3 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={exitMultiSelect}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                    aria-label="Exit selection mode"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <span className="badge-pill bg-white/10 text-white text-xs font-semibold px-3 py-1">
                    {selectedIds.size} of {filtered.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                  >
                    {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkRemove}
                    className="cta-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold self-start sm:self-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="glass-soft rounded-2xl py-12 text-center">
                <p className="text-gray-300 text-sm">No titles match that filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTab("all");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300"
                >
                  <Check className="h-3.5 w-3.5" />
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 content-auto">
                {filtered.map((movie, idx) => {
                  const isSelected = selectedIds.has(movie.id);
                  return (
                    <div
                      key={movie.id}
                      className={`relative group ${
                        isMultiSelect ? "cursor-pointer" : ""
                      }`}
                      onClick={isMultiSelect ? () => toggleSelect(movie.id) : undefined}
                    >
                      <MovieCard
                        movie={movie}
                        index={idx}
                        priority={idx < 6}
                      />
                      {isMultiSelect && (
                        <div
                          className={`absolute top-2 left-2 z-30 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                            isSelected
                              ? "border-red-500 bg-red-500"
                              : "border-white/50 bg-black/50 hover:border-white hover:bg-white/10"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(movie.id);
                          }}
                        >
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>
                      )}
                      {isMultiSelect && isSelected && (
                        <div
                          className="absolute inset-0 bg-red-500/20 rounded-[6px] ring-2 ring-red-500/50 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default MyList;
