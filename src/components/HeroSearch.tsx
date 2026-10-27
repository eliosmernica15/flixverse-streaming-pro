"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Film, Tv, User, TrendingUp, Compass, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TMDBMovie, searchMulti, searchPeople, getContentImage } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";

interface HeroResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  media_type?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  known_for_department?: string;
}

const TRENDING = [
  { label: "Action", href: "/browse/action", icon: Film, color: "text-red-400" },
  { label: "Sci-Fi", href: "/browse/sci-fi", icon: Compass, color: "text-blue-400" },
  { label: "Series", href: "/tv-shows", icon: Tv, color: "text-purple-400" },
  { label: "Trending Now", href: "/browse/trending-now", icon: TrendingUp, color: "text-yellow-400" },
];

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HeroResult[]>([]);
  const [openResults, setOpenResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("search");

  // Live search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setOpenResults(false); return; }
    setLoading(true);
    setOpenResults(true);
    const timer = setTimeout(async () => {
      try {
        const [multi, people] = await Promise.all([searchMulti(query), searchPeople(query)]);
        const all = [
          ...multi.map((i: TMDBMovie) => ({ ...i, media_type: i.media_type || (i.title ? "movie" : "tv") })),
          ...people.map((p: { id: number; name?: string; profile_path?: string; media_type?: string; known_for_department?: string }) => ({ ...p, media_type: "person" })),
        ] as HeroResult[];
        setResults(all.filter((r) => (r.media_type === "person" ? r.name : r.title || r.name)).slice(0, 8));
      } catch {
        toast({ title: t("error"), description: t("errorDesc"), variant: "destructive" });
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, toast, t]);

  const handleSelect = useCallback((r: HeroResult) => {
    if (r.media_type === "person") router.push(`/person/${r.id}`);
    else router.push(`/movie/${r.id}?type=${r.title ? "movie" : "tv"}`);
    setQuery(""); setResults([]); setOpenResults(false); setActiveIndex(-1);
  }, [router]);

  const getImage = (r: HeroResult) => {
    if (r.media_type === "person") return getContentImage(r, "profile", "small");
    return getContentImage(r, r.poster_path ? "poster" : "backdrop", "small");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpenResults(false); inputRef.current?.blur(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((p) => Math.min(p + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((p) => Math.max(p - 1, -1)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) handleSelect(results[activeIndex]);
      else if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="max-w-2xl w-full">
      {/* Centered search bar */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/40 via-red-400/20 to-transparent rounded-[1.2rem] blur-xl opacity-60 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center">
          <Search className="absolute left-5 text-gray-300 w-5 h-5 z-10 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenResults(e.target.value.trim().length >= 2); setActiveIndex(-1); }}
            onFocus={() => { if (query.trim().length >= 2) setOpenResults(true); }}
            onBlur={() => setTimeout(() => setOpenResults(false), 180)}
            onKeyDown={handleKeyDown}
            placeholder="Search movies, TV & people..."
            aria-label="Search movies, TV shows and people"
            className="w-full pl-14 pr-14 py-4.5 text-base sm:text-lg rounded-2xl bg-black/50 backdrop-blur-2xl border-2 border-red-500/40 text-white placeholder:text-gray-400 focus:outline-none focus:border-red-500/80 focus:shadow-[0_0_20px_rgba(229,9,20,0.35)] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)]"
          />
          <div className="absolute right-4 flex items-center gap-2">
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setOpenResults(false); }} aria-label="Clear" className="p-1 rounded-full hover:bg-white/10 transition-colors" type="button">
                <X className="w-4 h-4 text-gray-300 hover:text-white" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex pointer-events-none select-none items-center rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">/
            </kbd>
          </div>
        </div>
      </div>

      {/* Trending grid — always visible like the image */}
      <div className="mt-5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/40">
        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Trending</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRENDING.map((s) => (
            <a key={s.href} href={s.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.15] transition-all group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-black/60 to-zinc-900 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                <s.icon className={`w-4 h-4 ${s.color} transition-transform group-hover:scale-110`} />
              </span>
              <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">{s.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Search results dropdown — only when typing */}
      {openResults && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-zinc-950/98 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 max-h-[22rem] overflow-y-auto custom-scrollbar animate-fade-in-up">
          {loading && (
            <div className="flex items-center justify-center gap-2.5 p-5 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="p-6 text-center">
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-medium">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="py-1">
              {results.map((r, i) => (
                <button
                  key={`${r.id}-${r.media_type}`}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 rounded-xl mx-1 my-0.5 ${i === activeIndex ? "bg-white/10 shadow-inner ring-1 ring-white/5" : "hover:bg-white/[0.04]"}`}
                >
                  <div className="relative shrink-0">
                    <img src={getImage(r) || "/placeholder-poster.png"} alt={r.title || r.name || ""} loading="lazy" width={48} height={r.media_type === "person" ? 48 : 64} className={`${r.media_type === "person" ? "w-10 h-10 rounded-full" : "w-10 h-14 rounded-lg"} object-cover bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-md ring-1 ring-white/5`} />
                    <span className={`absolute -top-0.5 -right-0.5 rounded-full p-0.5 text-[9px] font-black text-white shadow-lg ${r.media_type === "movie" ? "bg-red-600" : r.media_type === "tv" ? "bg-blue-600" : "bg-green-600"}`}>
                      {r.media_type === "person" ? "P" : r.media_type === "tv" ? "TV" : "F"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-semibold truncate">{r.title || r.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span className="uppercase font-bold text-[10px] tracking-wide">{r.media_type || (r.title ? "movie" : "tv")}</span>
                      {r.release_date || r.first_air_date ? <span>{new Date(r.release_date || r.first_air_date || "").getFullYear()}</span> : null}
                      {r.vote_average && r.vote_average > 0 ? <span className="text-yellow-400 font-bold">★ {r.vote_average.toFixed(1)}</span> : null}
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-gray-500 shrink-0 transition-all ${i === activeIndex ? "text-red-400 translate-x-0" : "-translate-x-1 opacity-0"}`} />
                </button>
              ))}
              <a href={`/search?q=${encodeURIComponent(query.trim())}`} className="flex items-center gap-2 px-4 py-2.5 mt-1 border-t border-white/5 text-xs font-black uppercase tracking-[0.15em] text-red-400 hover:text-red-300 hover:bg-white/[0.03] transition-colors rounded-xl mx-1">
                <Sparkles className="w-3 h-3" /> See all results for &ldquo;{query.trim()}&rdquo;
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
