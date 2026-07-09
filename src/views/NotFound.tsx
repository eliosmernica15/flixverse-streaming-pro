"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Reveal from "@/components/Reveal";
import { Home, Search, Sparkles } from "lucide-react";

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20 pb-16">
      <Reveal className="text-center max-w-lg w-full">
        <div className="glass-panel rounded-3xl p-10 sm:p-12 shadow-2xl shadow-black/40">
          <div className="relative inline-flex items-center justify-center mb-8">
            <span className="text-[8rem] sm:text-[10rem] font-black leading-none gradient-text select-none">404</span>
            <Sparkles className="absolute w-12 h-12 text-red-500 animate-pulse-glow" />
          </div>

          <span className="chip mb-4">Error 404</span>

          <h1 className="display-title text-2xl sm:text-3xl font-bold text-white mb-3 text-balance">
            Page not found
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved. Let&apos;s get you back to streaming.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn-primary px-6 py-3 gap-2 w-full sm:w-auto focus-ring">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus-ring min-h-[44px]"
            >
              <Search className="w-4 h-4" />
              Search Content
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
};

export default NotFound;
