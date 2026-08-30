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
import { playUiSound } from "@/lib/uiSound";
import { FOCUS_SEARCH_EVENT } from "@/hooks/useGlobalShortcuts";

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

const itemClass =
  "group flex min-h-[44px] cursor-pointer items-center rounded-xl px-3 text-sm text-gray-300 transition-colors data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-red-500/15 data-[selected=true]:to-orange-500/5 data-[selected=true]:text-white";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          playUiSound(prev ? "close" : "open");
          return !prev;
        });
      }
    };
    const onOpen = () => {
      playUiSound("open");
      setOpen(true);
    };
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
      <div className="glass-strong animate-scale-in overflow-hidden rounded-2xl text-white shadow-2xl shadow-black/60">
        <CommandInput
          placeholder="Search pages, movies, TV shows..."
          className="text-white"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="scrollbar-thin">
          <CommandEmpty>{searching ? "Searching..." : "No results found."}</CommandEmpty>

          {/* TMDB Content Results */}
          {results.length > 0 && (
            <CommandGroup
              heading="Content"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-red-400/90"
            >
              {results.map((item) => {
                const title = item.title || item.name || "Unknown";
                const year = (item.release_date || item.first_air_date || "").slice(0, 4);
                const isTv = item.media_type === "tv" || !!item.first_air_date;
                return (
                  <CommandItem key={`${item.id}-${item.media_type}`} onSelect={() => handleContentSelect(item)} className={itemClass}>
                    {isTv ? (
                      <Tv className="mr-2 h-4 w-4 text-blue-400" />
                    ) : (
                      <Film className="mr-2 h-4 w-4 text-red-400" />
                    )}
                    <span className="truncate">{title}</span>
                    {year && <span className="ml-2 text-xs text-gray-500">{year}</span>}
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
          <CommandGroup
            heading="Navigate"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-red-400/90"
          >
            {pages.map((page) => (
              <CommandItem key={page.href} onSelect={() => navigate(page.href)} className={itemClass}>
                <page.icon className="mr-2 h-4 w-4 text-red-400" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator className="bg-white/10" />
          <CommandGroup
            heading="Shortcuts"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-red-400/90"
          >
            <CommandItem
              onSelect={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
              }}
              className={itemClass}
            >
              <Search className="mr-2 h-4 w-4 text-gray-400" />
              Focus search
              <CommandShortcut className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.65rem]">
                /
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        {/* Keyboard hint footer */}
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-[0.7rem] text-gray-500">
          <span className="chip">↑↓ Navigate</span>
          <span className="chip">↵ Select</span>
          <span className="chip">Esc Close</span>
        </div>
      </div>
    </CommandDialog>
  );
}
