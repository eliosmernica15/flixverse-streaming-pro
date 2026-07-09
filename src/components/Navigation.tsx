"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { User, LogOut, Menu, X, Sparkles, ChevronDown, CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TMDBMovie, getContentType } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { formatPlanLabel } from "@/lib/billing/format";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { Button } from "@/components/ui/button";
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
  loading: () => <div className="hidden sm:block w-48 lg:w-64 h-9 rounded-xl bg-white/5 animate-pulse" />,
});

const NotificationSettings = dynamic(() => import("./NotificationSettings"), {
  ssr: false,
  loading: () => null,
});

const NotificationBell = dynamic(() => import("./NotificationBell"), {
  ssr: false,
  loading: () => null,
});

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isScrolled = useThrottledScroll(20);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();
  const { subscription, isPaid } = useSubscription();
  const { profile } = useUserProfileContext();
  const { toast } = useToast();
  const prefetchRoute = useRoutePrefetch();

  const handleMovieSelect = (movie: TMDBMovie) => {
    const type = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${type}`);
  };

  const isActive = (path: string) => pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
      router.push("/");
    } catch {
      toast({
        title: "Error signing out",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/tv-shows", label: "TV Shows" },
    { path: "/movies", label: "Movies" },
    { path: "/new-and-popular", label: "New & Popular" },
    { path: "/my-list", label: "My List" },
    { path: "/plans", label: "Plans" },
    { path: "/offline-library", label: "Offline" },
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-[background,box-shadow,border-color] duration-500 ${
        isScrolled
          ? "glass-strong shadow-2xl shadow-black/40 border-b border-white/10"
          : "bg-gradient-to-b from-black/90 via-black/45 to-transparent border-b border-transparent"
      }`}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 divider-glow" />

      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <div className="flex items-center">
            <Link
              href="/"
              className="group flex-shrink-0 rounded-xl focus-ring magnetic"
              onMouseEnter={() => prefetchRoute("/")}
              onFocus={() => prefetchRoute("/")}
            >
              <div className="flex items-center space-x-2.5">
                <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-red-500/20 to-purple-500/20 ring-1 ring-white/10">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-xl bg-red-500/40 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60"
                  />
                  <Sparkles className="relative h-5 w-5 text-red-500 transition-all duration-200 group-hover:-rotate-12 group-hover:scale-110 group-hover:text-red-400 sm:h-6 sm:w-6" />
                </div>
                <h1 className="font-black tracking-tight text-xl lg:text-2xl">
                  <span className="text-gradient-primary">Flix</span>
                  <span className="text-white">Verse</span>
                </h1>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-1 md:flex lg:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                prefetch
                onMouseEnter={() => prefetchRoute(link.path)}
                onFocus={() => prefetchRoute(link.path)}
                aria-current={isActive(link.path) ? "page" : undefined}
                className={`group relative flex min-h-[44px] items-center rounded-xl px-4 text-sm font-medium transition-colors duration-200 focus-ring lg:text-base ${
                  isActive(link.path) ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <span
                  className={`absolute inset-0 rounded-xl transition-colors duration-200 ${
                    isActive(link.path) ? "bg-white/10" : "bg-transparent group-hover:bg-white/5"
                  }`}
                />
                <span className="relative z-10">{link.label}</span>
                <span
                  className={`absolute -bottom-1 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500 transition-all duration-300 ${
                    isActive(link.path)
                      ? "w-6 opacity-100 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                      : "w-0 opacity-0 group-hover:w-4 group-hover:opacity-70"
                  }`}
                />
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden glow-hover rounded-xl sm:block">
              <SearchBar onMovieSelect={handleMovieSelect} />
            </div>

            {isAuthenticated && (
              <>
                <NotificationSettings />
                <NotificationBell />
              </>
            )}

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex min-h-[44px] items-center space-x-2 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/10 focus-ring sm:px-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9 overflow-hidden rounded-xl border border-white/10 sm:h-10 sm:w-10">
                        <AvatarImage
                          src={profile?.avatar_url || undefined}
                          className="h-full w-full object-cover"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-red-500 via-red-600 to-orange-500 text-xs font-bold text-white">
                          {profile?.display_name?.charAt(0).toUpperCase() ||
                            user?.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="hidden items-center space-x-1 lg:flex">
                      <span className="text-sm font-medium text-white">
                        {profile?.display_name || user?.email?.split("@")[0]}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:rotate-180 group-hover:text-white" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="glass-strong w-60 rounded-2xl border-white/10 p-2 shadow-2xl shadow-black/50"
                >
                  <div className="mb-2 rounded-xl bg-white/5 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-white">
                      {profile?.display_name || user?.email?.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-gray-400">{user?.email}</p>
                    {isPaid && (
                      <p className="truncate text-[10px] text-amber-400/90 mt-0.5">
                        {formatPlanLabel(subscription.plan)} plan
                      </p>
                    )}
                  </div>

                  <DropdownMenuItem
                    onClick={() => router.push("/profile?tab=billing")}
                    className="cursor-pointer rounded-xl py-3 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <CreditCard className="mr-3 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer rounded-xl py-3 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <User className="mr-3 h-4 w-4" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/my-list")}
                    className="cursor-pointer rounded-xl py-3 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                  >
                    <Sparkles className="mr-3 h-4 w-4" />
                    My Watchlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-2 bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer rounded-xl py-3 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button className="btn-shine min-h-[44px] rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-transform duration-200 hover:scale-105 hover:from-red-500 hover:to-red-400 press-effect focus-ring">
                  Sign In
                </Button>
              </Link>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors duration-200 hover:bg-white/10 focus-ring md:hidden"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
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
          <div className="animate-fade-in-up border-t border-white/10 md:hidden">
            <div className="glass-panel mb-4 mt-3 rounded-2xl p-3">
              <div className="px-2 py-2">
                <SearchBar onMovieSelect={handleMovieSelect} />
              </div>

              <div className="mt-1 space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    prefetch
                    onMouseEnter={() => prefetchRoute(link.path)}
                    onFocus={() => prefetchRoute(link.path)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive(link.path) ? "page" : undefined}
                    className={`block min-h-[44px] rounded-xl px-4 py-3 text-base font-medium transition-colors duration-200 focus-ring ${
                      isActive(link.path)
                        ? "border-l-2 border-red-500 bg-gradient-to-r from-red-500/20 to-orange-500/10 text-white"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
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
    </nav>
  );
};

export default Navigation;
