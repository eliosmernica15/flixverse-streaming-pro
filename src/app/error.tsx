"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20 pb-16 page-enter">
      <Reveal>
        <div className="glass-panel rounded-3xl p-10 text-center max-w-lg shadow-2xl">
          <div className="relative inline-flex items-center justify-center mb-6">
            <span className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl animate-pulse-glow" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Something went wrong</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            An unexpected error occurred. You can try again or return to the home page.
          </p>

          {error?.digest && (
            <p className="text-xs text-gray-600 mb-6 font-mono">Error ID: {error.digest}</p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => reset()} variant="gradient" className="min-h-[44px]">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline-glow" className="min-h-[44px]">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
