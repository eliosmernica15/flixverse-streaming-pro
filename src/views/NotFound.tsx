"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Search, Sparkles } from "lucide-react";

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20 pb-16">
      <div className="text-center max-w-lg">
        <div className="relative inline-flex items-center justify-center mb-8">
          <span className="text-[8rem] sm:text-[10rem] font-black leading-none text-white/5 select-none">404</span>
          <Sparkles className="absolute w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved. Let&apos;s get you back to streaming.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="btn-primary px-6 py-3 gap-2 w-full sm:w-auto">
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search Content
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
