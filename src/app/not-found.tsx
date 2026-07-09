"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";

export default function NotFoundPage() {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="auth-orb auth-orb-red" />
        <div className="auth-orb auth-orb-purple" />
      </div>

      <Reveal>
        <div className="relative z-10 text-center max-w-lg">
          <div className="relative inline-flex items-center justify-center mb-2">
            <h1 className="text-[8rem] sm:text-[10rem] font-black leading-none gradient-text select-none animate-float">
              404
            </h1>
            <Sparkles className="absolute -top-2 -right-2 w-10 h-10 text-red-500 animate-pulse-glow" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Page not found</h2>
          <p className="text-gray-400 mb-8 leading-relaxed text-balance">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved. Let&apos;s get you back to streaming.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild variant="gradient" className="min-h-[44px]">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline-glow" className="min-h-[44px]">
              <Link href="/search">
                <Search className="h-4 w-4" />
                Search Content
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
