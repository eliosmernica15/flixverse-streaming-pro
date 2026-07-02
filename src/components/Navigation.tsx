"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { User, LogOut, Menu, X, Sparkles, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TMDBMovie, getContentType } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
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
  loading: () => <div className="hidden sm:block w-48 lg:w-64 h-9 rounded-lg bg-white/5 animate-pulse" />,
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
      className={`fixed top-0 left-0 right-0 z-50 transition-[background,box-shadow] duration-500 ${
        isScrolled
          ? "glass-premium shadow-2xl shadow-black/40"
          : "bg-gradient-to-b from-black/90 via-black/50 to-transparent"
      }`}
    >
      <div
        className={`absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500 ${
          isScrolled ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 group" onMouseEnter={() => prefetchRoute("/")} onFocus={() => prefetchRoute("/")}>
              <div className="flex items-center space-x-2.5">
                <div className="relative">
                  <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 group-hover:text-red-400 transition-colors duration-200 group-hover:rotate-12" />
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                  <span className="text-gradient-primary">Flix</span>
                  <span className="text-white">Verse</span>
                </h1>
              </div>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                prefetch
                onMouseEnter={() => prefetchRoute(link.path)}
                onFocus={() => prefetchRoute(link.path)}
                className={`relative px-4 py-2.5 text-sm lg:text-base font-medium transition-colors duration-200 rounded-xl group ${
                  isActive(link.path) ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <span
                  className={`absolute inset-0 rounded-xl transition-colors duration-200 ${
                    isActive(link.path) ? "bg-white/10" : "bg-transparent group-hover:bg-white/5"
                  }`}
                />
                <span className="relative z-10">{link.label}</span>
                {isActive(link.path) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden sm:block">
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
                  <button className="flex items-center space-x-2 hover:bg-white/10 rounded-xl px-2 sm:px-3 py-2 transition-colors duration-200 group">
                    <div className="relative">
                      <Avatar className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 overflow-hidden">
                        <AvatarImage
                          src={profile?.avatar_url || undefined}
                          className="object-cover w-full h-full"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-red-500 via-red-600 to-orange-500 text-white text-xs font-bold">
                          {profile?.display_name?.charAt(0).toUpperCase() ||
                            user?.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                    </div>
                    <div className="hidden lg:flex items-center space-x-1">
                      <span className="text-sm font-medium text-white">
                        {profile?.display_name || user?.email?.split("@")[0]}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 glass-premium rounded-2xl p-2 border-white/10 mt-2"
                >
                  <div className="px-3 py-3 mb-2 bg-white/5 rounded-xl">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.display_name || user?.email?.split("@")[0]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>

                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer py-3"
                  >
                    <User className="w-4 h-4 mr-3" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/my-list")}
                    className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer py-3"
                  >
                    <Sparkles className="w-4 h-4 mr-3" />
                    My Watchlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10 my-2" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl cursor-pointer py-3"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-red-500/20 transition-transform duration-200 hover:scale-105 btn-shine">
                  Sign In
                </Button>
              </Link>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2.5 hover:bg-white/10 rounded-xl transition-colors duration-200"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden overflow-hidden animate-fade-in border-t border-white/10">
            <div className="py-4 space-y-2">
              <div className="px-2 py-2">
                <SearchBar onMovieSelect={handleMovieSelect} />
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  prefetch
                  onMouseEnter={() => prefetchRoute(link.path)}
                  onFocus={() => prefetchRoute(link.path)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200 ${
                    isActive(link.path)
                      ? "text-white bg-gradient-to-r from-red-500/20 to-orange-500/10 border-l-2 border-red-500"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
