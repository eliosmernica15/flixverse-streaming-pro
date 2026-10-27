"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Command as CommandPrimitive } from "cmdk";
import {
  ArrowRight,
  Clock,
  Compass,
  Film,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Tv,
  User,
  X,
} from "lucide-react";

import {
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FOCUS_SEARCH_EVENT } from "@/hooks/useGlobalShortcuts";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { cn } from "@/lib/utils";
import { getContentImage, searchMulti, searchPeople } from "@/utils/tmdbApi";
import {
  MAX_PER_GROUP,
  entryHref,
  groupSearchResults,
  isSearchableQuery,
  normalizeSearchResults,
  type SearchEntry,
  type SearchKind,
} from "@/utils/searchGrouping";

/**
 * Hero search that opens a command-palette panel (grouped results, uppercase
 * section headings, keyboard selection) built on the same cmdk primitives as
 * {@link CommandPalette}.
 *
 * The panel is portalled to `document.body` because the hero root is
 * `overflow-hidden` + `contain: paint` (HeroBanner.tsx), which would otherwise
 * clip it and forbid it from painting above the fixed navbar. cmdk resolves its
 * list through React context, so keyboard selection, ARIA wiring and
 * scroll-into-view all keep working through the portal.
 */

/** Idle-state shortcuts. Labels come from the i18n `browse`/`nav` namespaces. */
const BROWSE_SHORTCUTS = [
  { href: "/browse/action", labelKey: "action", icon: Film, color: "text-red-400" },
  { href: "/browse/sci-fi", labelKey: "sci-fi", icon: Compass, color: "text-blue-400" },
  { href: "/tv-shows", labelKey: "nav.tvShows", icon: Tv, color: "text-purple-400" },
  { href: "/browse/trending-now", labelKey: "trending-now", icon: TrendingUp, color: "text-yellow-400" },
] as const;

const GROUP_HEADING_CLASS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-red-400/90";

const ITEM_CLASS =
  "group flex min-h-[48px] cursor-pointer items-center rounded-xl px-3 text-sm text-gray-300 transition-colors data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-red-500/15 data-[selected=true]:to-orange-500/5 data-[selected=true]:text-white";

const BADGE_CLASS: Record<SearchKind, string> = {
  movie: "bg-red-600",
  tv: "bg-blue-600",
  person: "bg-green-600",
};

interface PanelRect {
  top: number;
  left: number;
  width: number;
}

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<PanelRect | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<number | null>(null);

  const router = useRouter();
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const tBrowse = useTranslations("browse");
  const { recentSearches, addSearch, removeSearch } = useRecentSearches();

  const searching = isSearchableQuery(query);

  useEffect(() => setMounted(true), []);

  // Debounced TMDB search. `apiCall` resolves to [] on failure rather than
  // throwing, so a failed lookup surfaces as the empty state.
  useEffect(() => {
    if (!isSearchableQuery(query)) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [multi, people] = await Promise.all([searchMulti(query.trim()), searchPeople(query.trim())]);
        if (!cancelled) setEntries(normalizeSearchResults(multi, people));
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  /** Anchor the fixed panel under the input, clamped to the viewport. */
  const updateRect = useCallback(() => {
    const node = anchorRef.current;
    if (!node) return;

    const box = node.getBoundingClientRect();
    const gutter = 16;
    const width = Math.min(box.width, window.innerWidth - gutter * 2);
    const maxLeft = Math.max(gutter, window.innerWidth - width - gutter);

    setRect({
      top: box.bottom + 12,
      left: Math.min(Math.max(box.left, gutter), maxLeft),
      width,
    });
  }, []);

  // Keep the panel glued to the input while the page scrolls or the view resizes.
  useEffect(() => {
    if (!mounted) return;

    updateRect();
    if (!open) return;

    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateRect();
      });
    };

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [open, mounted, updateRect]);

  // Pointer-down rather than blur: a click on a portalled row blurs the input
  // before the click lands, which would swallow the selection.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      // Dismissing also drops focus, so the input is never left focused with the
      // panel shut — a state where keystrokes would have nowhere to go.
      inputRef.current?.blur();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // The "/" shortcut dispatches this event globally; nothing else listens for it.
  useEffect(() => {
    const focusSearch = () => {
      setOpen(true);
      inputRef.current?.focus();
    };

    window.addEventListener(FOCUS_SEARCH_EVENT, focusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusSearch);
  }, []);

  // cmdk owns ArrowUp/ArrowDown/Home/End/Enter; Escape is not intercepted.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = useCallback(() => {
    setQuery("");
    setEntries([]);
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  const handleEntrySelect = useCallback(
    (entry: SearchEntry) => {
      if (query.trim()) addSearch(query.trim());
      setQuery("");
      setEntries([]);
      setOpen(false);
      router.push(entryHref(entry));
    },
    [addSearch, query, router],
  );

  const handleSeeAll = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [addSearch, query, router]);

  const handleRecentSelect = useCallback((term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

  const handleBrowseSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const grouped = useMemo(() => groupSearchResults(entries), [entries]);
  const movieHits = grouped.movies.slice(0, MAX_PER_GROUP);
  const tvHits = grouped.tvShows.slice(0, MAX_PER_GROUP);
  const peopleHits = grouped.people.slice(0, MAX_PER_GROUP);

  const browseLabel = (labelKey: string) =>
    labelKey === "nav.tvShows" ? tNav("tvShows") : tBrowse(labelKey);

  const renderEntry = (entry: SearchEntry) => {
    const isPerson = entry.kind === "person";
    const meta = isPerson ? entry.department : null;

    return (
      <CommandItem
        key={entry.key}
        value={entry.key}
        onSelect={() => handleEntrySelect(entry)}
        className={ITEM_CLASS}
      >
        <span className="relative mr-3 shrink-0">
          <Image
            src={getContentImage(
              { poster_path: entry.posterPath, profile_path: entry.profilePath },
              isPerson ? "profile" : "poster",
              "small",
            )}
            alt=""
            width={isPerson ? 40 : 40}
            height={isPerson ? 40 : 56}
            className={cn(
              "bg-gradient-to-br from-zinc-800 to-zinc-900 object-cover shadow-md ring-1 ring-white/5",
              isPerson ? "h-10 w-10 rounded-full" : "h-14 w-10 rounded-lg",
            )}
          />
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white ring-2 ring-black/70",
              BADGE_CLASS[entry.kind],
            )}
          >
            {isPerson ? <User className="h-2.5 w-2.5" /> : entry.kind === "tv" ? <Tv className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{entry.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {isPerson ? t("people") : entry.kind === "tv" ? tNav("tvShows") : tNav("movies")}
            </span>
            {meta ? <span className="truncate">{meta}</span> : null}
            {entry.year ? <span>{entry.year}</span> : null}
            {entry.voteAverage > 0 ? (
              <span className="font-bold text-yellow-400">★ {entry.voteAverage.toFixed(1)}</span>
            ) : null}
          </span>
        </span>

        <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-gray-500 opacity-0 transition-all group-data-[selected=true]:translate-x-0 group-data-[selected=true]:text-red-400 group-data-[selected=true]:opacity-100" />
      </CommandItem>
    );
  };

  // The panel stays mounted while closed. cmdk enumerates items through its list
  // ref (`Array.from(listInnerRef.current.querySelectorAll(…))`) and throws if the
  // value changes while the list is unmounted — which is exactly what a keystroke
  // after an outside dismissal does. `hidden` keeps the closed panel out of the
  // layout, the hit test and the accessibility tree.
  const panel =
    mounted && rect ? (
      <div
        ref={panelRef}
        hidden={!open}
        style={{ top: rect.top, left: rect.left, width: rect.width }}
        className={cn(
          "glass-strong fixed z-[70] origin-top overflow-hidden rounded-2xl text-white shadow-2xl shadow-black/60 motion-reduce:animate-none",
          open && "animate-scale-in",
        )}
      >
        <CommandList className="max-h-[min(22rem,60vh)] py-1.5">
          {searching ? (
            loading ? (
              <div className="px-3 py-1">
                <div className="flex items-center gap-2.5 px-2 py-3 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                  {t("searching")}
                </div>
                {[0, 1, 2].map((row) => (
                  <div key={row} className="mx-1 my-1 h-11 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {movieHits.length > 0 && (
                  <CommandGroup heading={tNav("movies")} className={GROUP_HEADING_CLASS}>
                    {movieHits.map(renderEntry)}
                  </CommandGroup>
                )}
                {tvHits.length > 0 && (
                  <CommandGroup heading={tNav("tvShows")} className={GROUP_HEADING_CLASS}>
                    {tvHits.map(renderEntry)}
                  </CommandGroup>
                )}
                {peopleHits.length > 0 && (
                  <CommandGroup heading={t("people")} className={GROUP_HEADING_CLASS}>
                    {peopleHits.map(renderEntry)}
                  </CommandGroup>
                )}

                {entries.length === 0 && (
                  <div className="px-6 py-8 text-center">
                    <Search className="mx-auto mb-3 h-8 w-8 text-gray-600" />
                    <p className="text-sm font-medium text-gray-300">{t("noResults")}</p>
                    <p className="mt-1 text-xs text-gray-500">{t("tryDifferent")}</p>
                  </div>
                )}

                <CommandSeparator className="my-1" />
                <CommandItem
                  value="see-all"
                  onSelect={handleSeeAll}
                  className="mx-1 flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-[0.15em] text-red-400 transition-colors data-[selected=true]:bg-white/[0.04] data-[selected=true]:text-red-300"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="truncate">
                    {t("seeAll")} &ldquo;{query.trim()}&rdquo;
                  </span>
                </CommandItem>
              </>
            )
          ) : (
            <>
              {recentSearches.length > 0 && (
                <CommandGroup heading={t("recent")} className={GROUP_HEADING_CLASS}>
                  {recentSearches.slice(0, 4).map((term) => (
                    <CommandItem
                      key={term}
                      value={`recent-${term}`}
                      onSelect={() => handleRecentSelect(term)}
                      className={ITEM_CLASS}
                    >
                      <Clock className="mr-3 h-4 w-4 shrink-0 text-gray-500" />
                      <span className="min-w-0 flex-1 truncate text-sm">{term}</span>
                      <button
                        type="button"
                        aria-label={t("removeRecent", { query: term })}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSearch(term);
                        }}
                        className="rounded-full p-1 text-gray-500 opacity-0 transition hover:bg-white/10 hover:text-white focus:opacity-100 group-data-[selected=true]:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading={t("browse")} className={GROUP_HEADING_CLASS}>
                {BROWSE_SHORTCUTS.map(({ href, labelKey, icon: Icon, color }) => (
                  <CommandItem
                    key={href}
                    value={`browse-${href}`}
                    onSelect={() => handleBrowseSelect(href)}
                    className={ITEM_CLASS}
                  >
                    <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-black/60 to-zinc-900 shadow-inner">
                      <Icon className={cn("h-4 w-4", color)} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-200">
                      {browseLabel(labelKey)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-gray-500 opacity-0 transition-all group-data-[selected=true]:translate-x-0 group-data-[selected=true]:text-red-400 group-data-[selected=true]:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-[0.7rem] text-gray-500">
          <span className="chip">↑↓ {t("hintNavigate")}</span>
          <span className="chip">↵ {t("hintSelect")}</span>
          <span className="chip">esc {t("hintClose")}</span>
        </div>
      </div>
    ) : null;

  return (
    <CommandPrimitive
      shouldFilter={false}
      loop
      label={t("ariaLabel")}
      className="w-full max-w-2xl"
    >
      <div ref={anchorRef} className="group relative">
        <div className="pointer-events-none absolute -inset-1 rounded-[1.2rem] bg-gradient-to-r from-red-500/40 via-red-400/20 to-transparent opacity-60 blur-xl transition-opacity duration-500 group-focus-within:opacity-100 motion-reduce:transition-none" />

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-5 z-10 h-5 w-5 text-gray-300" aria-hidden="true" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            aria-label={t("ariaLabel")}
            aria-keyshortcuts="/"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border-2 border-red-500/40 bg-black/50 py-4 pr-24 pl-14 text-base text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-300 placeholder:text-gray-400 focus:border-red-500/80 focus:shadow-[0_0_20px_rgba(229,9,20,0.35)] focus:outline-none sm:text-lg"
          />

          <div className="absolute right-4 flex items-center gap-2">
            {query ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t("clear")}
                className="rounded-full p-1 transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4 text-gray-300 hover:text-white" />
              </button>
            ) : null}
            <kbd className="pointer-events-none hidden select-none items-center rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-flex">
              {open ? "esc" : "/"}
            </kbd>
          </div>
        </div>
      </div>

      {panel ? createPortal(panel, document.body) : null}
    </CommandPrimitive>
  );
}
