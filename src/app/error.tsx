"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Home, RefreshCw, Sparkles } from "lucide-react";

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
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20 pb-16">
      <div className="text-center max-w-lg">
        <div className="relative inline-flex items-center justify-center mb-8">
          <Sparkles className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Something went wrong</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          An unexpected error occurred. You can try again or return to the home page.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary px-6 py-3 gap-2 w-full sm:w-auto inline-flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
