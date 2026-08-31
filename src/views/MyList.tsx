"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Heart, LogIn, Film, Tv, Search, Sparkles, ArrowRight, Trash2, Check } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import PageContainer from "@/components/PageContainer";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useToast } from "@/hooks/use-toast";
import { TMDBMovie, getContentTitle, getContentType } from "@/utils/tmdbApi";
import { useRouter } from "next/navigation";
import { useUserProfileContext } from "@/contexts/UserProfileContext";

type ListTab = "all" | "movies" | "series";

const MyList = () => {
  const { isAuthenticated } = useAuth();
  const { movieList, loading, removeFromList } = useUserMovieListContext();
  const { profile } = useUserProfileContext();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<ListTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "az">("recent");

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

  const greeting = profile?.display_name?.split(" ")[0] ?? "your";
  const tabs: { id: ListTab; label: string; count: number; icon: typeof Film }[] = [
    { id: "all", label: "All", count: myMovies.length, icon: Sparkles },
    { id: "movies", label: "Movies", count: movieCount, icon: Film },
    { id: "series", label: "Series", count: seriesCount, icon: Tv },
  ];

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
            <Link
              href="/"
              className="group inline-flex items-center gap-2 self-start sm:self-auto rounded-md bg-white px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/90"
            >
              <Search className="h-4 w-4" />
              Discover more
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
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
          <EmptyState
            icon={<Heart className="w-10 h-10 text-red-500" />}
            title="Your list is empty"
            description="Start building your personal watchlist by tapping the + on any title. Anything you save will appear here, ready whenever you are."
            actionLabel="Discover Movies"
            actionHref="/"
          />
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
                {filtered.map((movie, idx) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    index={idx}
                    priority={idx < 6}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default MyList;
