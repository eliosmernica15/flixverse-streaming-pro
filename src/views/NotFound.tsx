"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Search, Compass, Film, Tv, Heart, Bookmark, Sparkles } from "lucide-react";

const QUICK_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv-shows", label: "TV Shows", icon: Tv },
  { href: "/new-and-popular", label: "New & Popular", icon: Sparkles },
  { href: "/my-list", label: "My List", icon: Heart },
  { href: "/browse/trending-now", label: "Trending", icon: Compass },
];

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center px-4 pt-24 pb-20 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239, 68, 68, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 100%, rgba(168, 85, 247, 0.12) 0%, transparent 60%)",
        }}
      />
      <div className="max-w-2xl w-full text-center relative z-10 animate-fade-in-up">
        <div className="relative inline-block mb-6">
          <span
            aria-hidden
            className="text-[10rem] sm:text-[14rem] font-black leading-[0.85] tracking-tighter text-white select-none"
            style={{
              background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </span>
          <Sparkles
            className="absolute -top-1 -right-2 w-8 h-8 text-amber-400 animate-pulse"
            aria-hidden
          />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          Lost in the catalog
        </span>

        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-3 text-balance leading-[1.1]">
          We can&apos;t find that title
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved. Try one of these instead.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-white text-black font-bold text-sm px-6 py-3 transition-colors hover:bg-white/90 focus-ring"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 text-gray-200 hover:text-white hover:bg-white/10 text-sm font-semibold px-6 py-3 transition-colors focus-ring"
          >
            <Search className="w-4 h-4" />
            Search Content
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-2xl mx-auto">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex flex-col items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2 py-3 transition-colors hover:bg-white/8 hover:border-white/15 focus-ring"
            >
              <l.icon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-red-400" />
              <span className="text-[10px] font-semibold text-gray-300 transition-colors group-hover:text-white">
                {l.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
