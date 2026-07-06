"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-6">A critical error occurred.</p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
