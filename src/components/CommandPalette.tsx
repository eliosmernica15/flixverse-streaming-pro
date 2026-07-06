"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Film, Tv, Home, Search, Heart, Sparkles, TrendingUp, User, WifiOff } from "lucide-react";
import { searchMulti, TMDBMovie } from "@/utils/tmdbApi";

export const OPEN_COMMAND_PALETTE_EVENT = "flixverse:open-command";

const pages = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv-shows", label: "TV Shows", icon: Tv },
  { href: "/new-and-popular", label: "New & Popular", icon: TrendingUp },
  { href: "/my-list", label: "My List", icon: Heart },
  { href: "/offline-library", label: "Offline Library", icon: WifiOff },
  { href: "/search", label: "Search", icon: Search },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/auth", label: "Sign In", icon: Sparkles },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  // TMDB search when query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const data = await searchMulti(query);
        if (!cancelled) {
          setResults(
            data
              .filter((item) => item.poster_path && (item.title || item.name))
              .slice(0, 8)
          );
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const handleContentSelect = useCallback(
    (item: TMDBMovie) => {
      const type = item.media_type || (item.first_air_date ? "tv" : "movie");
      navigate(`/movie/${item.id}?type=${type}`);
    },
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="bg-zinc-950 border border-white/10 text-white">
      <CommandInput
        placeholder="Search pages, movies, TV shows..."
        className="text-white"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* TMDB Content Results */}
        {results.length > 0 && (
          <CommandGroup heading="Content">
            {results.map((item) => {
              const title = item.title || item.name || "Unknown";
              const year = (item.release_date || item.first_air_date || "").slice(0, 4);
              const isTv = item.media_type === "tv" || !!item.first_air_date;
              return (
                <CommandItem
                  key={`${item.id}-${item.media_type}`}
                  onSelect={() => handleContentSelect(item)}
                >
                  {isTv ? (
                    <Tv className="mr-2 h-4 w-4 text-blue-400" />
                  ) : (
                    <Film className="mr-2 h-4 w-4 text-red-400" />
                  )}
                  <span>{title}</span>
                  {year && (
                    <span className="ml-2 text-xs text-gray-500">{year}</span>
                  )}
                  {item.vote_average ? (
                    <span className="ml-auto text-xs text-gray-500">
                      {item.vote_average.toFixed(1)}
                    </span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Page Navigation */}
        <CommandGroup heading="Navigate">
          {pages.map((page) => (
            <CommandItem key={page.href} onSelect={() => navigate(page.href)}>
              <page.icon className="mr-2 h-4 w-4 text-red-400" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Shortcuts">
          <CommandItem onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("flixverse:focus-search")); }}>
            <Search className="mr-2 h-4 w-4" />
            Focus search
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </div>
    </CommandDialog>
  );
}
