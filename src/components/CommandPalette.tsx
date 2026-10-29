"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Command as CommandPrimitive } from "cmdk";
import {
  ArrowRight,
  Clock,
  Compass,
  CreditCard,
  Film,
  Heart,
  HelpCircle,
  Home,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Tv,
  User,
  WifiOff,
  X,
} from "lucide-react";

import {
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/hooks/useGlobalShortcuts";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { cn } from "@/lib/utils";
import { playUiSound } from "@/lib/uiSound";
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

export { OPEN_COMMAND_PALETTE_EVENT } from "@/hooks/useGlobalShortcuts";

/**
 * Site-wide command palette.
 *
 * A centred modal over a blurred backdrop — deliberately *not* anchored to the
 * control that opened it. It is reachable two ways, and both funnel through the
 * same `open` state:
 *
 *  - the navbar `Ctrl K` button, which dispatches {@link OPEN_COMMAND_PALETTE_EVENT}
 *  - the Ctrl+K / Cmd+K accelerator, handled here and nowhere else
 *
 * Ctrl+K is owned by this component alone. `useGlobalShortcuts` used to handle
 * it *and* dispatch the open event, which meant a single keypress both opened
 * and toggled the palette — the two writes collapsed onto one value and the
 * palette never appeared.
 *
 * The palette unmounts while closed (Radix's default), which discards cmdk's
 * internal store. That is why the query is cleared when the palette *opens*
 * rather than when it closes: resetting on close would write to cmdk's state
 * after its list had already unmounted, which makes cmdk's item enumeration
 * (`Array.from(listInnerRef.current?.querySelectorAll(...))`) throw.
 */

/** Idle-state shortcuts. Labels come from the i18n `browse`/`nav` namespaces. */
const BROWSE_SHORTCUTS = [
  { href: "/browse/action", labelKey: "action", icon: Film, color: "text-red-400" },
  { href: "/browse/sci-fi", labelKey: "sci-fi", icon: Compass, color: "text-blue-400" },
  { href: "/tv-shows", labelKey: "nav.tvShows", icon: Tv, color: "text-purple-400" },
  { href: "/browse/trending-now", labelKey: "trending-now", icon: TrendingUp, color: "text-yellow-400" },
] as const;

const GROUP_HEADING_CLASS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-red-500/80";

const ITEM_CLASS =
  "group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 transition-all data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white";

const BADGE_CLASS: Record<SearchKind, string> = {
  movie: "bg-red-600",
  tv: "bg-blue-600",
  person: "bg-green-600",
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const tBrowse = useTranslations("browse");
  const tFooter = useTranslations("footer");
  const { recentSearches, addSearch, removeSearch } = useRecentSearches();

  const searching = isSearchableQuery(query);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };

    const onOpenRequest = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  // Played from an effect rather than inside a state updater: updaters can run
  // twice under StrictMode, which would double-fire the tone.
  const sawFirstRender = useRef(false);
  useEffect(() => {
    if (!sawFirstRender.current) {
      sawFirstRender.current = true;
      return;
    }
    playUiSound(open ? "open" : "close");
  }, [open]);

  // Reset on open, never on close — see the note above the component.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEntries([]);
    setLoading(false);
  }, [open]);

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
        const [multi, people] = await Promise.all([
          searchMulti(query.trim()),
          searchPeople(query.trim()),
        ]);
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

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const handleEntrySelect = useCallback(
    (entry: SearchEntry) => {
      if (query.trim()) addSearch(query.trim());
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

  // Recents and browse shortcuts keep the palette open — the user is still
  // mid-search, so closing would throw away the context they came for.
  const handleRecentSelect = useCallback((term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

  const grouped = useMemo(() => groupSearchResults(entries), [entries]);
  const movieHits = grouped.movies.slice(0, MAX_PER_GROUP);
  const tvHits = grouped.tvShows.slice(0, MAX_PER_GROUP);
  const peopleHits = grouped.people.slice(0, MAX_PER_GROUP);

  const pages = useMemo(
    () => [
      { href: "/", label: tNav("home"), icon: Home },
      { href: "/movies", label: tNav("movies"), icon: Film },
      { href: "/tv-shows", label: tNav("tvShows"), icon: Tv },
      { href: "/new-and-popular", label: tNav("newAndPopular"), icon: TrendingUp },
      { href: "/my-list", label: tNav("myList"), icon: Heart },
      { href: "/profile", label: tNav("myProfile"), icon: User },
      { href: "/plans", label: tNav("plans"), icon: CreditCard },
      { href: "/offline-library", label: tFooter("offlineLibrary"), icon: WifiOff },
      { href: "/help", label: tFooter("help"), icon: HelpCircle },
    ],
    [tNav, tFooter],
  );

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
        <span className="relative shrink-0">
          <Image
            src={getContentImage(
              { poster_path: entry.posterPath, profile_path: entry.profilePath },
              isPerson ? "profile" : "poster",
              "small",
            )}
            alt=""
            width={40}
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
            {isPerson ? (
              <User className="h-2.5 w-2.5" />
            ) : entry.kind === "tv" ? (
              <Tv className="h-2.5 w-2.5" />
            ) : (
              <Film className="h-2.5 w-2.5" />
            )}
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

  const renderNavRow = (
    key: string,
    href: string,
    icon: React.ReactNode,
    label: string,
  ) => (
    <CommandItem
      key={key}
      value={key}
      onSelect={() => navigate(href)}
      className={ITEM_CLASS}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-gray-500 opacity-0 transition-all group-data-[selected=true]:translate-x-0 group-data-[selected=true]:text-red-400 group-data-[selected=true]:opacity-100" />
    </CommandItem>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="z-[80] bg-black/70 backdrop-blur-md" />
        {/*
          Centred with the standalone `translate` property, not Tailwind's
          `-translate-x-1/2 -translate-y-1/2`. Both do the same thing visually, but
          the utilities compile into `transform`, and tailwindcss-animate's
          `animate-in`/`zoom-in-95` write `transform` from a keyframe too — the
          keyframe wins for the length of the animation, so the panel used to grow
          out of a point half its own size off-centre before snapping into place.
          `translate` is a separate property, so nothing here fights the animation.

          The Content must also stay sized to the panel rather than stretched to the
          viewport: Radix forces inline `pointer-events: auto` onto this node in
          modal mode, which makes a full-bleed frame eat the backdrop clicks that are
          supposed to dismiss the palette.
        */}
        <DialogPrimitive.Content
          aria-label={t("ariaLabel")}
          // No description element: the palette's own content is the context.
          aria-describedby={undefined}
          className="glass-strong fixed left-1/2 top-1/2 z-[80] w-[min(38rem,calc(100vw-2rem))] [translate:-50%_-50%] overflow-hidden rounded-xl border border-white/10 bg-black/80 text-white shadow-2xl shadow-black/80 backdrop-blur-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          <DialogTitle className="sr-only">{t("ariaLabel")}</DialogTitle>

          <CommandPrimitive
            shouldFilter={false}
            loop
            label={t("ariaLabel")}
            className="w-full"
          >
            <div
              className="flex items-center gap-2 border-b border-white/5 px-3"
              cmdk-input-wrapper=""
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={t("placeholder")}
                aria-label={t("ariaLabel")}
                aria-keyshortcuts="Control+K Meta+K"
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
              />
              <DialogPrimitive.Close
                aria-label={t("hintClose")}
                className="shrink-0 select-none rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                ESC
              </DialogPrimitive.Close>
            </div>

            <CommandList className="max-h-[min(26rem,60vh)] py-1.5">
              {searching ? (
                loading ? (
                  <div className="px-3 py-1">
                    <div className="flex items-center gap-2.5 px-2 py-3 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                      {t("searching")}
                    </div>
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="mx-1 my-1 h-11 animate-pulse rounded-xl bg-white/5" />
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
                          <Clock className="h-4 w-4 shrink-0 text-gray-500" />
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
                    {BROWSE_SHORTCUTS.map(({ href, labelKey, icon: Icon, color }) =>
                      renderNavRow(
                        `browse-${href}`,
                        href,
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-black/60 to-zinc-900 shadow-inner">
                          <Icon className={cn("h-4 w-4", color)} />
                        </span>,
                        browseLabel(labelKey),
                      ),
                    )}
                  </CommandGroup>

                  {/* "Pages", not "Browse" — the shortcut group above already
                      carries that heading, and two identical headings read as a
                      rendering bug. */}
                  <CommandGroup heading={t("pages")} className={GROUP_HEADING_CLASS}>
                    {pages.map((page) =>
                      renderNavRow(
                        `page-${page.href}`,
                        page.href,
                        <page.icon className="h-4 w-4 shrink-0 text-gray-500" />,
                        page.label,
                      ),
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
