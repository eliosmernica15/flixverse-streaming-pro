"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, User, Film, Tv, Clock, TrendingUp, Compass, Loader2 } from "lucide-react";
import { TMDBMovie, TMDBPerson, searchMulti, searchPeople, getContentImage } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";
import { FOCUS_SEARCH_EVENT } from "@/hooks/useGlobalShortcuts";

const RECENT_KEY = "flixverse:recent-searches";

interface SearchBarProps {
  onMovieSelect: (movie: TMDBMovie) => void;
}

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  profile_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  known_for_department?: string;
  known_for?: TMDBMovie[];
}

const TRENDING_SUGGESTIONS = [
  { label: "Trending Now", href: "/browse/trending-now", icon: TrendingUp },
  { label: "Action", href: "/browse/action", icon: Film },
  { label: "Sci-Fi", href: "/browse/sci-fi", icon: Compass },
  { label: "Series", href: "/tv-shows", icon: Tv },
];

const SearchBar = ({ onMovieSelect }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const t = useTranslations("search");

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
  }, []);

  // Push successful query to recent
  useEffect(() => {
    if (!query.trim()) return;
    return () => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return;
      setRecent((prev) => {
        const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 6);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
  }, [query]);

  useEffect(() => {
    const focusSearch = () => {
      inputRef.current?.focus();
      setIsOpen(true);
    };

    window.addEventListener(FOCUS_SEARCH_EVENT, focusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusSearch);
  }, []);

  useEffect(() => {
    const searchContent = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // Search for movies, TV shows, and people
        const [multiResults, peopleResults] = await Promise.all([
          searchMulti(query),
          searchPeople(query)
        ]);

        // Combine results and prioritize by relevance
        const allResults: any[] = [
          ...multiResults.map(item => ({
            ...item,
            media_type: item.media_type || (item.title ? 'movie' : 'tv')
          })),
          ...peopleResults.map(person => ({
            ...person,
            media_type: 'person'
          }))
        ];

        const combined = allResults
          .filter(item => {
            // Filter out items without essential information
            if (item.media_type === 'person') {
              return item.name && (item.profile_path || item.known_for_department);
            }
            return (item.title || item.name) && (item.poster_path || item.backdrop_path || (item.vote_average ?? 0) > 0);
          })
          .sort((a, b) => {
            // Prioritize movies and TV shows over people
            if (a.media_type === 'person' && b.media_type !== 'person') return 1;
            if (b.media_type === 'person' && a.media_type !== 'person') return -1;

            // Then sort by vote average
            return (b.vote_average || 0) - (a.vote_average || 0);
          })
          .slice(0, 12) as SearchResult[];

        setResults(combined);
        setActiveIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        toast({
          title: t("error"),
          description: t("errorDesc"),
          variant: "destructive"
        });
      }
      setLoading(false);
    };

    const debounceTimer = setTimeout(searchContent, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, toast, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultSelect = (result: SearchResult) => {
    if (result.media_type === 'person') {
      router.push(`/person/${result.id}`);
    } else {
      onMovieSelect(result as TMDBMovie);
    }
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const getResultImage = (result: SearchResult) => {
    return getContentImage(result, result.media_type === 'person' ? 'profile' : 'poster', 'small');
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return <Film className="w-3 h-3" />;
      case 'tv':
        return <Tv className="w-3 h-3" />;
      case 'person':
        return <User className="w-3 h-3" />;
      default:
        return <Film className="w-3 h-3" />;
    }
  };

  const getMediaTypeColor = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return 'bg-red-600';
      case 'tv':
        return 'bg-blue-600';
      case 'person':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div ref={searchRef} className="relative max-w-md w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              setActiveIndex(-1);
              inputRef.current?.blur();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, -1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (activeIndex >= 0 && activeIndex < results.length) {
                handleResultSelect(results[activeIndex]);
              } else if (query.trim()) {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                setQuery("");
                setResults([]);
                setIsOpen(false);
                setActiveIndex(-1);
              }
            }
          }}
          placeholder={t("placeholder")}
          aria-label={t("ariaLabel")}
          aria-keyshortcuts="/"
          className="input-field pl-10 pr-16 py-2.5 text-sm"
        />
        <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none select-none items-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          /
        </kbd>
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-10 lg:right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-2 bg-zinc-950/98 border border-white/10 rounded-xl max-h-[28rem] overflow-y-auto z-50 shadow-2xl shadow-black/50 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center gap-2 p-4 text-gray-400 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-6 text-center">
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-300">No content found for &quot;{query}&quot;</p>
              <p className="text-[11px] text-gray-500 mt-1">Try a different title or name</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-1.5">
              {results.map((result, index) => (
                <button
                  key={`${result.id}-${result.media_type}`}
                  onClick={() => handleResultSelect(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  ref={(el) => {
                    if (index === activeIndex) {
                      el?.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left rounded-md mx-1.5 ${
                    index === activeIndex ? "bg-white/10" : "hover:bg-white/8"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={getResultImage(result)}
                      alt={result.title || result.name}
                      loading="lazy"
                      decoding="async"
                      width={48}
                      height={result.media_type === 'person' ? 48 : 64}
                      className={`${result.media_type === 'person' ? 'w-10 h-10 rounded-full' : 'w-10 h-14 rounded'} object-cover shadow-md bg-white/5`}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.dataset.fallback === "1") return;
                        target.dataset.fallback = "1";
                        target.src = getResultImage(result);
                      }}
                    />
                    <div className={`absolute -top-1 -right-1 ${getMediaTypeColor(result.media_type || 'movie')} text-white p-0.5 rounded-sm`}>
                      {getMediaTypeIcon(result.media_type || 'movie')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-semibold truncate">
                      {result.title || result.name}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                      {result.media_type === 'person' ? (
                        <span>{result.known_for_department || "Actor"}</span>
                      ) : (
                        <>
                          <span>
                            {result.release_date || result.first_air_date
                              ? new Date(result.release_date || result.first_air_date).getFullYear()
                              : "—"}
                          </span>
                          {result.vote_average && result.vote_average > 0 && (
                            <>
                              <span className="text-gray-600">·</span>
                              <span className="text-yellow-400 font-semibold">★ {result.vote_average.toFixed(1)}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <div className="border-t border-white/5 px-3 py-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                    setIsOpen(false);
                  }}
                  className="w-full text-left text-[11px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 px-1 py-1"
                >
                  See all results for &quot;{query.trim()}&quot; →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty-state dropdown: recent + trending */}
      {isOpen && query.trim().length < 2 && recent.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950/98 border border-white/10 rounded-xl z-50 shadow-2xl shadow-black/50 overflow-hidden">
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recent searches
              </span>
              <button
                type="button"
                onClick={() => {
                  setRecent([]);
                  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
                }}
                className="text-[10px] font-semibold text-gray-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setQuery(r);
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors focus-ring"
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="border-t border-white/5 mt-1 pt-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2 py-1.5">
                Trending
              </span>
              {TRENDING_SUGGESTIONS.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                >
                  <s.icon className="h-3.5 w-3.5 text-red-400" />
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
