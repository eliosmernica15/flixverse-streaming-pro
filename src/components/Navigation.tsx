"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { User, LogOut, Menu, X, Sparkles, ChevronDown, CreditCard, PartyPopper } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TMDBMovie, getContentType } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { formatPlanLabel } from "@/lib/billing/format";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { BrowseMegaMenu, BrowseMegaMenuMobile } from "@/components/BrowseMegaMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SearchBar = dynamic(() => import("./SearchBar"), {
  ssr: false,
  loading: () => <div className="hidden sm:block w-48 lg:w-64 h-9 rounded-md bg-white/5 animate-pulse" />,
});

const NotificationSettings = dynamic(() => import("./NotificationSettings"), {
  ssr: false,
  loading: () => null,
});

const NotificationBell = dynamic(() => import("./NotificationBell"), {
  ssr: false,
  loading: () => null,
});

const FlixPartyJoinDialog = dynamic(
  () => import("./player/FlixPartyJoinDialog").then((m) => m.FlixPartyJoinDialog),
  { ssr: false }
);

const LanguageSwitcher = dynamic(() => import("./LanguageSwitcher").then((m) => m.LanguageSwitcher), {
  ssr: false,
  loading: () => null,
});

const OfflineSyncBadge = dynamic(() => import("./OfflineSyncBadge").then((m) => m.OfflineSyncBadge), {
  ssr: false,
  loading: () => null,
});

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showJoinParty, setShowJoinParty] = useState(false);
  const isScrolled = useThrottledScroll(20);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();
  const { subscription, isPaid } = useSubscription();
  const { profile } = useUserProfileContext();
  const { toast } = useToast();
  const prefetchRoute = useRoutePrefetch();
  const t = useTranslations("nav");
  const tc = useTranslations("common");

  const handleMovieSelect = (movie: TMDBMovie) => {
    const type = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${type}`);
  };

  const isActive = (path: string) => pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast({
        title: t("signOutFailed"),
        description: t("tryAgain"),
        variant: "destructive",
      });
    }
  };

  const navLinks = [
    { path: "/", label: t("home"), key: "home" },
    { path: "/tv-shows", label: t("tvShows"), key: "tvShows" },
    { path: "/movies", label: t("movies"), key: "movies" },
    { path: "/new-and-popular", label: t("newAndPopular"), key: "newAndPopular" },
    { path: "/my-list", label: t("myList"), key: "myList" },
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useBodyScrollLock(isMobileMenuOpen);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileMenuOpen]);

  return (
    <nav
      style={{ paddingTop: "var(--safe-top)" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-[background,box-shadow,backdrop-filter,border-color] duration-500 ${
        isScrolled
          ? "bg-[#0a0a0c]/85 backdrop-blur-xl border-b border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          : "bg-gradient-to-b from-black/80 via-black/40 to-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between gap-3 lg:h-[68px]">
          <div className="flex min-w-0 flex-1 items-center gap-5 lg:gap-8">
            <Link
              href="/"
              className="group flex-shrink-0 rounded-md focus-ring"
              onMouseEnter={() => prefetchRoute("/")}
              onFocus={() => prefetchRoute("/")}
            >
              <div className="flex items-center space-x-2">
                <div className="relative grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 transition-transform duration-200 group-hover:scale-105">
                  <Sparkles className="relative h-4 w-4 text-white" />
                </div>
                <h1 className="font-black tracking-tight text-lg lg:text-xl">
                  <span className="text-white">Flix</span>
                  <span className="text-red-500">Verse</span>
                </h1>
              </div>
            </Link>

            <div className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
              {isFeatureEnabled("browse-mega-menu") && (
                <div className="relative z-[60] shrink-0 overflow-visible">
                  <BrowseMegaMenu />
                </div>
              )}
              <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
                {navLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.path}
                    prefetch
                    onMouseEnter={() => prefetchRoute(link.path)}
                    onFocus={() => prefetchRoute(link.path)}
                    aria-current={isActive(link.path) ? "page" : undefined}
                    className={`nav-link group relative flex min-h-[40px] flex-shrink-0 items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors duration-200 focus-ring lg:text-sm ${
                      isActive(link.path) ? "text-white font-semibold" : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <span
                      className={`absolute inset-0 rounded-md transition-colors duration-200 ${
                        isActive(link.path) ? "bg-white/10" : "bg-transparent"
                      }`}
                    />
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <SearchBar onMovieSelect={handleMovieSelect} />
            </div>

            <LanguageSwitcher />
            <OfflineSyncBadge />

            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => setShowJoinParty(true)}
                  className="group hidden min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-300 transition-all hover:text-white focus-ring lg:flex"
                  title="Join a watch party with a 6-letter code"
                >
                  <PartyPopper className="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
                <NotificationSettings />
                <NotificationBell />
              </>
            )}

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex min-h-[40px] items-center space-x-1.5 rounded-md px-1.5 py-1 transition-colors duration-200 hover:bg-white/10 focus-ring sm:px-2">
                    <div className="relative">
                      <Avatar className="h-7 w-7 overflow-hidden rounded-md ring-1 ring-white/10 sm:h-8 sm:w-8">
                        <AvatarImage
                          src={profile?.avatar_url || undefined}
                          className="h-full w-full object-cover"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-red-500 via-red-600 to-orange-500 text-[11px] font-bold text-white sm:text-xs">
                          {profile?.display_name?.charAt(0).toUpperCase() ||
                            user?.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-hover:rotate-180 group-hover:text-white sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="glass-strong w-60 rounded-xl border-white/10 p-2 shadow-2xl shadow-black/50"
                >
                  <div className="mb-1.5 rounded-lg bg-white/5 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-white">
                      {profile?.display_name || user?.email?.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-gray-400">{user?.email}</p>
                    {isPaid && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400 ring-1 ring-yellow-500/30">
                        {formatPlanLabel(subscription.plan)} plan
                      </span>
                    )}
                  </div>

                  <DropdownMenuItem
                    onClick={() => router.push("/profile?tab=billing")}
                    className="cursor-pointer rounded-lg py-2.5 text-[13px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <CreditCard className="mr-2.5 h-4 w-4" />
                    {t("billing")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer rounded-lg py-2.5 text-[13px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <User className="mr-2.5 h-4 w-4" />
                    {t("myProfile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/my-list")}
                    className="cursor-pointer rounded-lg py-2.5 text-[13px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <Sparkles className="mr-2.5 h-4 w-4" />
                    {t("myWatchlist")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1.5 bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer rounded-lg py-2.5 text-[13px] text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
                  >
                    <LogOut className="mr-2.5 h-4 w-4" />
                    {tc("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <button className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-lg shadow-red-500/25 transition-all duration-200 hover:bg-red-500 hover:shadow-red-500/40 focus-ring sm:px-4 sm:text-sm">
                  {tc("signIn")}
                </button>
              </Link>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10 focus-ring lg:hidden"
              aria-label={isMobileMenuOpen ? tc("closeMenu") : tc("openMenu")}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 text-white" />
              ) : (
                <Menu className="h-5 w-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="animate-fade-in-up border-t border-white/10 lg:hidden">
            <div className="glass-soft mb-4 mt-3 rounded-xl p-3">
              <div className="px-2 py-2">
                <SearchBar onMovieSelect={handleMovieSelect} />
              </div>

              <div className="mt-1 space-y-1">
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinParty(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex w-full min-h-[40px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 focus-ring"
                  >
                    <PartyPopper className="h-4 w-4" />
                    {t("joinParty")}
                  </button>
                )}
                {isFeatureEnabled("browse-mega-menu") && (
                  <BrowseMegaMenuMobile onNavigate={() => setIsMobileMenuOpen(false)} />
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.path}
                    prefetch
                    onMouseEnter={() => prefetchRoute(link.path)}
                    onFocus={() => prefetchRoute(link.path)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive(link.path) ? "page" : undefined}
                    className={`nav-link block min-h-[40px] whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-ring ${
                      isActive(link.path)
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <FlixPartyJoinDialog isOpen={showJoinParty} onClose={() => setShowJoinParty(false)} />
      )}
    </nav>
  );
};

export default Navigation;
